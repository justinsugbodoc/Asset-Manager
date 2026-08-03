export const INSURANCE_STORAGE_KEY = 'sugbodoc_insurance';
export const INSURANCE_CLAIMS_STORAGE_KEY = 'sugbodoc_insurance_claims';


export const INSURANCE_PROVIDERS = ['PhilHealth', 'Maxicare', 'Intellicare', 'Medicard'] as const;

export type InsuranceProvider = (typeof INSURANCE_PROVIDERS)[number];
export type CoverageType = 'HMO' | 'Government' | 'Private Health Plan';
export type InsuranceStatus = 'Active' | 'Expired' | 'Pending Verification';
export type InsuranceClaimStatus = 'Draft' | 'Processing' | 'Approved' | 'Partially Approved' | 'Denied';
export type CoverageCategory = 'appointment' | 'bill' | 'medication';

export type InsuranceRecord = {
  provider: string;
  memberNumber: string;
  plan: string;
  coverageType: string;
  expirationDate: string;
  updatedAt?: string;
};

export type InsuranceEstimate = {
  eligible: boolean;
  status: InsuranceStatus;
  coveragePercent: number;
  originalAmount: number;
  estimatedCoverage: number;
  patientBalance: number;
};

export type InsuranceClaim = {
  id: string;
  reference: string;
  relatedType: CoverageCategory;
  relatedId: string;
  relatedLabel: string;
  originalAmount: number;
  estimatedCoverage: number;
  patientBalance: number;
  date: string;
  status: InsuranceClaimStatus;
  provider: string;
};

const COVERAGE_RULES: Record<string, Record<CoverageCategory, number>> = {
  PhilHealth: { appointment: 0.7, bill: 0.6, medication: 0.4 },
  Maxicare: { appointment: 0.8, bill: 0.7, medication: 0.5 },
  Intellicare: { appointment: 0.75, bill: 0.65, medication: 0.45 },
  Medicard: { appointment: 0.7, bill: 0.6, medication: 0.5 },
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function loadInsurance(): InsuranceRecord | null {
  try {
    const raw = localStorage.getItem(INSURANCE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as InsuranceRecord) : null;
  } catch {
    return null;
  }
}

export function saveInsurance(record: InsuranceRecord) {
  localStorage.setItem(INSURANCE_STORAGE_KEY, JSON.stringify(record));
}

export function getInsuranceStatus(record: InsuranceRecord | null): InsuranceStatus {
  if (!record?.provider || !record.memberNumber || !record.plan || !record.coverageType || !record.expirationDate) {
    return 'Pending Verification';
  }
  const expiration = new Date(`${record.expirationDate}T23:59:59`);
  return expiration.getTime() < Date.now() ? 'Expired' : 'Active';
}

export function getCoveragePercent(record: InsuranceRecord | null, category: CoverageCategory) {
  if (!record || getInsuranceStatus(record) !== 'Active') return 0;
  return COVERAGE_RULES[record.provider]?.[category] ?? 0;
}

export function calculateInsuranceEstimate(
  amount: number,
  record: InsuranceRecord | null,
  category: CoverageCategory,
): InsuranceEstimate {
  const originalAmount = roundMoney(Math.max(0, amount));
  const status = getInsuranceStatus(record);
  const coveragePercent = getCoveragePercent(record, category);
  const estimatedCoverage = roundMoney(originalAmount * coveragePercent);

  return {
    eligible: status === 'Active' && estimatedCoverage > 0,
    status,
    coveragePercent,
    originalAmount,
    estimatedCoverage,
    patientBalance: roundMoney(originalAmount - estimatedCoverage),
  };
}

export function loadClaims(): InsuranceClaim[] {
  try {
    const raw = localStorage.getItem(INSURANCE_CLAIMS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as InsuranceClaim[]) : [];
  } catch {
    return [];
  }
}

export function saveClaims(claims: InsuranceClaim[]) {
  localStorage.setItem(INSURANCE_CLAIMS_STORAGE_KEY, JSON.stringify(claims));
}

export function updateClaimStatus(
  relatedType: CoverageCategory,
  relatedId: string,
  status: InsuranceClaimStatus,
) {
  const current = loadClaims();
  const updated = current.map(claim =>
    claim.relatedType === relatedType && claim.relatedId === relatedId
      ? { ...claim, status }
      : claim,
  );
  saveClaims(updated);
  return updated.find(
    claim => claim.relatedType === relatedType && claim.relatedId === relatedId,
  ) ?? null;
}

export function createOrUpdateClaim(
  claim: Omit<InsuranceClaim, 'id' | 'reference' | 'date'>,
) {
  const current = loadClaims();
  const existing = current.find(
    item => item.relatedType === claim.relatedType && item.relatedId === claim.relatedId,
  );
  if (existing) return existing;

  const created: InsuranceClaim = {
    ...claim,
    id: `claim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    reference: `CLM-${Math.floor(100000 + Math.random() * 900000)}`,
    date: new Date().toISOString(),
  };
  saveClaims([created, ...current]);
  return created;
}

export function formatInsurancePercent(percent: number) {
  return `${Math.round(percent * 100)}%`;
}