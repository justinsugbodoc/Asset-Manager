import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/layout/app-shell';
import { CreditCard, FileText, CheckCircle2, ChevronRight, ShieldCheck, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { calculateInsuranceEstimate, createOrUpdateClaim, loadInsurance } from '@/lib/insurance';
import { getCurrentSessionUser } from '@/hooks/use-auth';
import { getLatestPatientEncounter } from '@/lib/encounters';
import { serverConfirmBillPayment, serverCreateBillCheckout, serverRecords, serverUpdateMe } from '@/lib/server';

export default function Billing() {
  const currentUser = getCurrentSessionUser();
  const activeEncounter = getLatestPatientEncounter(currentUser?.id, currentUser?.name);
  const [bills, setBills] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { toast } = useToast();
  const insurance = useMemo(() => loadInsurance(), []);

  useEffect(() => {
    let active = true;
    void serverRecords().then(({ encounters }) => {
      const sharedBills = encounters.flatMap((encounter: any) =>
        (encounter.bills ?? []).map((bill: any) => ({
          ...bill,
          encounterId: bill.encounterId ?? encounter.id,
          encounterReference: bill.encounterReference ?? encounter.encounterReference,
        })),
      );
      if (active) {
        if (sharedBills.length) {
          setBills(sharedBills.filter((bill: any) => bill.status !== 'Paid'));
          setHistory(sharedBills.filter((bill: any) => bill.status === 'Paid'));
        } else {
          setBills([]);
          setHistory([]);
        }
        setBillingError(null);
        setIsLoading(false);
      }
    }).catch((error) => {
      if (active) {
        setBills([]);
        setHistory([]);
        setBillingError(error instanceof Error ? error.message : 'Unable to load billing records.');
        setIsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (params.get('payment') !== 'success' || !sessionId) return;

    const verifyPayment = async () => {
      try {
        const confirmed = await serverConfirmBillPayment(sessionId);
        const paidBills = confirmed.bills.map((bill: any) => ({
          ...bill,
          status: 'Paid',
          receiptId: bill.receiptId ?? confirmed.receiptId,
          encounterId: bill.encounterId ?? activeEncounter?.id,
          encounterReference: bill.encounterReference ?? activeEncounter?.encounterReference,
        }));
        const paidBillIds = new Set(paidBills.map((bill: any) => String(bill.id)));
        setBills((current) => current.filter((bill) => !paidBillIds.has(String(bill.id))));
        setHistory((current) => [
          ...paidBills,
          ...current.filter((bill: any) => !paidBillIds.has(String(bill.id))),
        ]);

        const draft = (() => {
          try {
            const raw = localStorage.getItem('sugbodoc_billing_checkout_draft');
            return raw ? JSON.parse(raw) as {
              originalAmount: number;
              estimatedCoverage: number;
              patientBalance: number;
              provider: string;
            } : null;
          } catch {
            return null;
          }
        })();
          createOrUpdateClaim({
            relatedType: 'bill',
            relatedId: paidBillIds.size === 1 ? String([...paidBillIds][0]) : 'all-bills',
            relatedLabel: selectedBill?.description ?? 'SugboDoc Outstanding Bills',
            originalAmount: draft?.originalAmount ?? paidBills.reduce((sum, bill) => sum + Number(bill.amount ?? 0), 0),
            estimatedCoverage: draft?.estimatedCoverage ?? 0,
            patientBalance: draft?.patientBalance ?? paidBills.reduce((sum, bill) => sum + Number(bill.amount ?? 0), 0),
            status: 'Processing',
            provider: draft?.provider ?? insurance?.provider ?? 'Testing estimate',
          });
          void serverUpdateMe({ claims: JSON.parse(localStorage.getItem('sugbodoc_insurance_claims') ?? '[]') });
          localStorage.removeItem('sugbodoc_billing_checkout_draft');
          toast({
            title: 'Payment Successful',
            description: `Successfully paid ${formatMoney(paidBills.reduce((sum, bill) => sum + Number(bill.amount ?? 0), 0))} through Stripe.`,
          });
      } catch (error) {
        toast({
          title: 'Payment Verification Pending',
          description: error instanceof Error ? error.message : 'Please refresh shortly.',
          variant: 'destructive',
        });
      } finally {
        window.history.replaceState({}, '', window.location.pathname);
      }
    };

    void verifyPayment();
  }, []);

  const totalOutstanding = bills.reduce((acc, b) => acc + b.amount, 0);
  const outstandingEstimate = calculateInsuranceEstimate(totalOutstanding, insurance, 'bill');

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
  };

  const openPayment = (bill?: any) => {
    setSelectedBill(bill || null);
    setIsPaymentModalOpen(true);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      const billsToPay = selectedBill ? [selectedBill] : [...bills];
      const originalAmount = billsToPay.reduce((sum, bill) => sum + bill.amount, 0);
      const estimate = calculateInsuranceEstimate(originalAmount, insurance, 'bill');
      const total = estimate.patientBalance;
      const appBase = `${window.location.origin}${import.meta.env.BASE_URL ?? '/'}`;
      const result = await serverCreateBillCheckout({
        billId: selectedBill?.id ?? 'all-bills',
        billIds: billsToPay.map(bill => String(bill.id)),
        description: selectedBill?.description ?? 'SugboDoc Outstanding Bills',
        amount: total,
        insuranceCoverageAmount: estimate.estimatedCoverage,
        successUrl: `${appBase}billing?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${appBase}billing?payment=cancelled`,
      });
      if (!result.checkoutUrl) throw new Error('Unable to start Stripe Checkout');
      localStorage.setItem('sugbodoc_billing_checkout_draft', JSON.stringify({
        billIds: billsToPay.map(bill => bill.id),
        originalAmount,
        estimatedCoverage: estimate.estimatedCoverage,
        patientBalance: estimate.patientBalance,
        provider: insurance?.provider ?? 'Testing estimate',
      }));
      window.location.href = result.checkoutUrl;
    } catch (error) {
      setIsProcessing(false);
      toast({
        title: 'Unable to Start Payment',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const downloadReceipt = (receiptId: string) => {
    toast({
      title: "Receipt Downloaded",
      description: `Receipt ${receiptId} has been saved to your device.`,
    });
  };

  if (isLoading) {
    return (
      <AppShell title="Billing & Payments">
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <CreditCard className="mx-auto mb-3 h-10 w-10 animate-pulse text-primary" />
          <p className="font-semibold">Loading your billing records…</p>
          <p className="mt-1 text-sm text-muted-foreground">Fetching the latest information from SugboDoc.</p>
        </div>
      </AppShell>
    );
  }

  if (billingError) {
    return (
      <AppShell title="Billing & Payments">
        <div className="rounded-2xl border border-destructive/30 bg-card p-10 text-center shadow-sm">
          <CreditCard className="mx-auto mb-3 h-10 w-10 text-destructive" />
          <p className="font-semibold">Billing records are unavailable</p>
          <p className="mt-1 text-sm text-muted-foreground">{billingError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Billing & Payments">
      
      {/* Summary Card */}
      <div className="bg-primary text-primary-foreground rounded-2xl p-6 shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <CreditCard className="w-32 h-32 -rotate-12 translate-x-4 -translate-y-4" />
        </div>
        <div className="relative z-10">
          <p className="text-primary-foreground/80 font-medium mb-1">Estimated Patient Balance</p>
          <h2 className="text-4xl font-bold mb-2">{formatMoney(outstandingEstimate.patientBalance)}</h2>
          <p className="mb-4 text-sm text-primary-foreground/75">
            Original {formatMoney(totalOutstanding)} · Estimated coverage {formatMoney(outstandingEstimate.estimatedCoverage)}
          </p>
          {bills.length > 0 ? (
            <button 
              onClick={() => openPayment()}
              className="bg-card text-foreground px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-card/90 transition-colors shadow-sm inline-flex items-center gap-2"
            >
              Pay All Bills <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex items-center gap-2 text-emerald-300 font-medium bg-black/10 w-fit px-4 py-2 rounded-lg backdrop-blur-sm">
              <CheckCircle2 className="h-5 w-5" /> You are all caught up!
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        
        {/* Outstanding Bills */}
          <div>
          <h3 className="text-lg font-bold mb-4">Pending Bills</h3>
          <div className="space-y-3">
            {bills.length > 0 ? (
              bills.map(bill => (
                <div key={bill.id} className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between hover:border-primary/30 transition-colors">
                  <div>
                    <h4 className="font-bold text-foreground">{bill.description}</h4>
                    <p className="text-sm text-muted-foreground">{bill.date}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {(() => {
                      const estimate = calculateInsuranceEstimate(bill.amount, insurance, 'bill');
                      return (
                        <div className="text-right">
                          <span className="font-bold text-lg">{formatMoney(estimate.patientBalance)}</span>
                          {estimate.estimatedCoverage > 0 && (
                            <p className="text-[11px] text-emerald-600">Est. coverage {formatMoney(estimate.estimatedCoverage)}</p>
                          )}
                        </div>
                      );
                    })()}
                    <button 
                      onClick={() => openPayment(bill)}
                      className="text-xs font-bold bg-primary/10 text-primary px-4 py-1.5 rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      Pay Now
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 bg-card border border-border rounded-xl border-dashed">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3 opacity-80" />
                <p className="text-muted-foreground">No pending bills</p>
              </div>
            )}
          </div>
        </div>

        {/* Payment History */}
        <div>
          <h3 className="text-lg font-bold mb-4">Payment History</h3>
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="divide-y divide-border">
              {history.map(item => (
                <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                  <div>
                    <h4 className="font-medium text-foreground">{item.description}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-muted-foreground">{item.date}</span>
                      {(item as any).encounterReference && <span className="text-[10px] font-mono text-primary">{(item as any).encounterReference}</span>}
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase">Paid</span>
                    </div>
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                    <span className="font-bold">{formatMoney(item.amount)}</span>
                    <button 
                      onClick={() => downloadReceipt(item.receiptId!)}
                      className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" /> Receipt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
              <h2 className="text-lg font-bold">Complete Payment</h2>
              <button onClick={() => !isProcessing && setIsPaymentModalOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            
            <form onSubmit={handlePayment} className="p-5 space-y-6">
              
                {(() => {
                  const estimate = calculateInsuranceEstimate(
                    selectedBill ? selectedBill.amount : totalOutstanding,
                    insurance,
                    'bill',
                  );
                  return (
                    <div className="space-y-2 rounded-xl border border-primary/10 bg-primary/5 p-4">
                      <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-primary font-medium">{selectedBill ? 'Selected Bill' : 'Total Outstanding'}</p>
                  <p className="text-xs text-muted-foreground">{selectedBill?.description || 'All pending bills'}</p>
                </div>
                        <div className="text-2xl font-bold text-foreground">{formatMoney(estimate.patientBalance)}</div>
                      </div>
                      <div className="border-t border-primary/10 pt-2 text-xs">
                        <div className="flex justify-between"><span className="text-muted-foreground">Original amount</span><span>{formatMoney(estimate.originalAmount)}</span></div>
                        <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Estimated insurance coverage</span><span className="text-emerald-600">−{formatMoney(estimate.estimatedCoverage)}</span></div>
                        <div className="mt-1 flex justify-between font-bold"><span>Patient balance</span><span className="text-primary">{formatMoney(estimate.patientBalance)}</span></div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Testing estimate only · {insurance?.provider || 'No active provider'}</p>
                    </div>
                  );
                })()}

              <div className="rounded-xl border border-primary/15 bg-primary/5 p-5 text-center">
                <ExternalLink className="h-8 w-8 text-primary mx-auto mb-3" />
                <p className="font-semibold text-foreground">Secure Stripe Checkout</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You’ll be redirected to Stripe to securely choose an available payment method and complete your payment.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center mt-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" /> Payment details are handled securely by Stripe
              </div>

              <button 
                type="submit" 
                disabled={isProcessing}
                className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-bold shadow-md hover:bg-primary/90 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Pay {formatMoney(calculateInsuranceEstimate(selectedBill ? selectedBill.amount : totalOutstanding, insurance, 'bill').patientBalance)}</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
