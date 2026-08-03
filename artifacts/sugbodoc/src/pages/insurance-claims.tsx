import { useMemo, useState } from 'react';
import AppShell from '@/components/layout/app-shell';
import { Link } from 'wouter';
import { ChevronRight, FileCheck2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getCurrentSessionUser } from '@/hooks/use-auth';
import { serverUpdateMe } from '@/lib/server';
import {
  formatInsurancePercent,
  getInsuranceStatus,
  type InsuranceClaim,
  type InsuranceClaimStatus,
} from '@/lib/insurance';

const statusStyles: Record<InsuranceClaimStatus, string> = {
  Draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  Processing: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  Approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Partially Approved': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  Denied: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
};

export default function InsuranceClaims() {
  const { toast } = useToast();
  const sessionUser = getCurrentSessionUser();
  const [claims, setClaims] = useState<InsuranceClaim[]>(() => (sessionUser?.claims ?? []) as InsuranceClaim[]);
  const insurance = useMemo(() => sessionUser?.insurance as Parameters<typeof getInsuranceStatus>[0], [sessionUser]);
  const insuranceStatus = getInsuranceStatus(insurance);

  const simulateDecision = (id: string, status: 'Approved' | 'Partially Approved' | 'Denied') => {
    const updated = claims.map(claim =>
      claim.id === id ? { ...claim, status } : claim,
    );
    setClaims(updated);
    void serverUpdateMe({ claims: updated });
    toast({
      title: `Claim marked ${status}`,
      description: 'This is a testing-only insurance decision.',
    });
  };

  return (
    <AppShell title="Insurance Claims">
      <div className="space-y-6 animate-in fade-in">
        <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-3 text-primary"><ShieldCheck className="h-6 w-6" /></div>
              <div>
                <h2 className="text-xl font-bold">Coverage claims</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Track testing-only estimates submitted for appointments, bills, and pharmacy orders.
                </p>
              </div>
            </div>
            <Link href="/profile" className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
              Manage insurance <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-background px-3 py-1.5 text-foreground shadow-sm">
              {insurance?.provider || 'No provider saved'}
            </span>
            <span className="rounded-full bg-background px-3 py-1.5 text-muted-foreground shadow-sm">
              {insuranceStatus} · estimates only
            </span>
          </div>
        </div>

        {claims.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center shadow-sm">
            <FileCheck2 className="mx-auto h-12 w-12 text-primary/30" />
            <h3 className="mt-4 text-lg font-bold">No claims yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Insurance claims will appear here after you book an appointment, pay a bill, or start a covered pharmacy order.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {claims.map(claim => (
              <div key={claim.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{claim.reference}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${statusStyles[claim.status]}`}>
                        {claim.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-foreground">{claim.relatedLabel}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Related {claim.relatedType} · {new Date(claim.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} · {claim.provider}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xl font-bold text-primary">₱{claim.patientBalance.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">estimated patient balance</p>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-muted/40 p-4 text-sm">
                  <div><p className="text-xs text-muted-foreground">Original</p><p className="mt-1 font-bold">₱{claim.originalAmount.toFixed(2)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Estimated coverage</p><p className="mt-1 font-bold text-emerald-600">₱{claim.estimatedCoverage.toFixed(2)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Coverage rate</p><p className="mt-1 font-bold">{claim.originalAmount ? formatInsurancePercent(claim.estimatedCoverage / claim.originalAmount) : '0%'}</p></div>
                </div>
                {(claim.status === 'Processing' || claim.status === 'Draft') && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => simulateDecision(claim.id, 'Approved')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">Demo approve</button>
                    <button onClick={() => simulateDecision(claim.id, 'Partially Approved')} className="rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-muted">Demo partial</button>
                    <button onClick={() => simulateDecision(claim.id, 'Denied')} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50">Demo deny</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}