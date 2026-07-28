import { useState } from 'react';
import AppShell from '@/components/layout/app-shell';
import { bills as mockBills, pastBills } from '@/data/mock';
import { CreditCard, FileText, CheckCircle2, ChevronRight, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Billing() {
  const [bills, setBills] = useState(mockBills);
  const [history, setHistory] = useState(pastBills);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [isProcessing, setIsProcessing] = useState(false);

  const { toast } = useToast();

  const totalOutstanding = bills.reduce((acc, b) => acc + b.amount, 0);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
  };

  const openPayment = (bill?: any) => {
    setSelectedBill(bill || null);
    setIsPaymentModalOpen(true);
  };

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    // Simulate API delay
    setTimeout(() => {
      setIsProcessing(false);
      setIsPaymentModalOpen(false);
      
      const billsToPay = selectedBill ? [selectedBill] : [...bills];
      
      // Update states
      if (selectedBill) {
        setBills(bills.filter(b => b.id !== selectedBill.id));
      } else {
        setBills([]);
      }

      const newHistoryItems = billsToPay.map(b => ({
        ...b,
        status: 'Paid',
        receiptId: `RCP-${Math.floor(1000 + Math.random() * 9000)}`
      }));

      setHistory(prev => [...newHistoryItems, ...prev]);

      toast({
        title: "Payment Successful",
        description: `Successfully paid ${formatMoney(billsToPay.reduce((sum, b) => sum + b.amount, 0))}.`,
      });
    }, 1500);
  };

  const downloadReceipt = (receiptId: string) => {
    toast({
      title: "Receipt Downloaded",
      description: `Receipt ${receiptId} has been saved to your device.`,
    });
  };

  return (
    <AppShell title="Billing & Payments">
      
      {/* Summary Card */}
      <div className="bg-primary text-primary-foreground rounded-2xl p-6 shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <CreditCard className="w-32 h-32 -rotate-12 translate-x-4 -translate-y-4" />
        </div>
        <div className="relative z-10">
          <p className="text-primary-foreground/80 font-medium mb-1">Total Outstanding</p>
          <h2 className="text-4xl font-bold mb-4">{formatMoney(totalOutstanding)}</h2>
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
                    <span className="font-bold text-lg">{formatMoney(bill.amount)}</span>
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
              
              <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 flex justify-between items-center">
                <div>
                  <p className="text-sm text-primary font-medium">{selectedBill ? 'Selected Bill' : 'Total Outstanding'}</p>
                  <p className="text-xs text-muted-foreground">{selectedBill?.description || 'All pending bills'}</p>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {formatMoney(selectedBill ? selectedBill.amount : totalOutstanding)}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold mb-3 block">Payment Method</label>
                <div className="grid grid-cols-3 gap-3">
                  {['card', 'gcash', 'maya'].map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`p-3 rounded-xl border text-center transition-all ${paymentMethod === method ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/50'}`}
                    >
                      <div className="font-bold text-sm capitalize">{method === 'card' ? 'Card' : method}</div>
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'card' && (
                <div className="space-y-4 animate-in fade-in">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Card Number</label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <input type="text" placeholder="0000 0000 0000 0000" className="w-full h-11 pl-10 pr-3 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-sm" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Expiry</label>
                      <input type="text" placeholder="MM/YY" className="w-full h-11 px-3 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-sm" required />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">CVV</label>
                      <input type="text" placeholder="123" className="w-full h-11 px-3 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-sm" required />
                    </div>
                  </div>
                </div>
              )}

              {(paymentMethod === 'gcash' || paymentMethod === 'maya') && (
                <div className="p-6 text-center border border-dashed border-border rounded-xl animate-in fade-in">
                  <p className="text-sm text-muted-foreground mb-4">You will be redirected to the {paymentMethod.toUpperCase()} app to authorize this transaction securely.</p>
                  <img src={`https://ui-avatars.com/api/?name=${paymentMethod}&background=random&color=fff&size=64&rounded=true`} alt={paymentMethod} className="mx-auto rounded-xl w-12 h-12 grayscale-[50%]" />
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center mt-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" /> Secure 256-bit encryption
              </div>

              <button 
                type="submit" 
                disabled={isProcessing}
                className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-bold shadow-md hover:bg-primary/90 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Pay {formatMoney(selectedBill ? selectedBill.amount : totalOutstanding)}</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
