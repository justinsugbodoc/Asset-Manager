import { STORAGE_KEYS, type SessionUser } from '@/hooks/use-auth';
import type { Encounter } from '@/lib/encounters';

const base = () => import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${base()}/api${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detailMessages = Object.entries(body?.details?.fieldErrors ?? {})
      .flatMap(([field, messages]) => (Array.isArray(messages) ? messages.map(message => `${field}: ${message}`) : []));
    const message = typeof body?.error === 'string' ? body.error : `Request failed (${response.status})`;
    throw new Error(detailMessages.length ? `${message} ${detailMessages.join(' ')}` : message);
  }
  return body as T;
}

export type ServerAppointment = {
  id: string;
  reference: string;
  date: string;
  time: string;
  status: string;
  doctor: Record<string, unknown>;
  billing?: Record<string, unknown>;
  emailStatus?: 'sent' | 'failed' | 'pending';
  emailMessageId?: string;
};

export type ServerPatient = SessionUser & {
  lastActive: string;
  emergencyContact?: { name: string; number: string } | null;
  appointments: ServerAppointment[];
  records: Encounter[];
};

export type ServerAuthResponse = {
  token: string;
  user: SessionUser;
};

export function serverLogin(email: string, password: string) {
  return request<ServerAuthResponse>('/accounts/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function serverRegister(input: {
  fullName: string;
  email: string;
  phone: string;
  birthday: string;
  gender: string;
  password: string;
}) {
  return request<ServerAuthResponse>('/accounts/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function serverUpdateMe(input: {
  name?: string;
  email?: string;
  phone?: string;
  birthday?: string;
  gender?: string;
  insurance?: Record<string, unknown> | null;
  claims?: Record<string, unknown>[];
}) {
  return request<{ user: SessionUser }>('/accounts/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function serverAppointments() {
  return request<{ appointments: ServerAppointment[] }>('/appointments');
}

export function serverCreateAppointment(input: {
  date: string;
  time: string;
  doctor: Record<string, unknown>;
  billing?: Record<string, unknown>;
}) {
  return request<{ appointment: ServerAppointment }>('/appointments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function serverUpdateAppointmentStatus(id: string, status: string) {
  return request<{ appointment: ServerAppointment }>(`/appointments/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function serverPatients() {
  return request<{ patients: ServerPatient[] }>('/admin/patients');
}

export function serverUpdatePatient(id: string, input: {
  name?: string;
  status?: 'Active' | 'Inactive';
  insurance?: Record<string, unknown> | null;
  claims?: Record<string, unknown>[];
}) {
  return request<{ patient: ServerPatient }>(`/admin/patients/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export type ServerSchedule = {
  id: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  clinic: string;
  day: string;
  startTime: string;
  endTime: string;
  slots: number;
  enabled: boolean;
};

export function serverAdminSchedules() {
  return request<{ schedules: ServerSchedule[] }>('/admin/schedules');
}

export function serverSaveAdminSchedules(schedules: ServerSchedule[]) {
  return request<{ schedules: ServerSchedule[] }>('/admin/schedules', {
    method: 'PUT',
    body: JSON.stringify({ schedules }),
  });
}

export type ServerAuditEvent = {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
};

export function serverAuditEvents() {
  return request<{ events: ServerAuditEvent[] }>('/admin/audit-events');
}

export function serverCreateAuditEvent(action: string, target: string) {
  return request<{ event: ServerAuditEvent }>('/admin/audit-events', {
    method: 'POST',
    body: JSON.stringify({ action, target }),
  });
}

export function serverRecords(patientId?: string) {
  const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
  return request<{ patientId: string; encounters: Encounter[] }>(`/records${query}`);
}

export function serverMigrateRecords(patientId: string, encounters: Encounter[]) {
  return request<{ patientId: string; encounters: Encounter[] }>('/records/migrate', {
    method: 'POST',
    body: JSON.stringify({ patientId, encounters }),
  });
}

export function serverCreateEncounter(encounter: Encounter) {
  return request<{ encounter: Encounter }>('/records', {
    method: 'POST',
    body: JSON.stringify(encounter),
  });
}

export function serverUpdateEncounter(encounter: Encounter) {
  return request<{ encounter: Encounter }>(`/records/${encodeURIComponent(encounter.id)}`, {
    method: 'PUT',
    body: JSON.stringify(encounter),
  });
}

export function serverUpdatePatientEncounterData(
  encounterId: string,
  data: {
    pharmacyOrders?: unknown[];
    bills?: unknown[];
    payments?: unknown[];
    billing?: Record<string, unknown>;
    claims?: unknown[];
  },
) {
  return request<{ encounter: Encounter }>(
    `/records/${encodeURIComponent(encounterId)}/patient-data`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
  );
}

export function serverConfirmBillPayment(sessionId: string) {
  return request<{
    bills: any[];
    payments: any[];
    receiptId: string;
    status: string;
  }>('/stripe/confirm-bill-payment', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

export function serverCreateBillCheckout(input: {
  billId: string;
  billIds: string[];
  description: string;
  amount: number;
  insuranceCoverageAmount: number;
  successUrl: string;
  cancelUrl: string;
}) {
  return request<{ checkoutUrl: string; sessionId: string }>('/stripe/create-checkout-session', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type ServerMedication = {
  id: string;
  name: string;
  description: string;
  genericName: string;
  dosage: string;
  dosageForm: string;
  form: string;
  category: string;
  price: number;
  stock: number;
  enabled: boolean;
  partnerLocations: string[];
  updatedAt: string;
};

export function serverPharmacyCatalog() {
  return request<{ medications: ServerMedication[] }>('/pharmacy/catalog');
}

export function serverUpdatePharmacyMedication(item: ServerMedication) {
  return request<{ medication: ServerMedication }>(`/pharmacy/catalog/${encodeURIComponent(item.id)}`, {
    method: 'PUT',
    body: JSON.stringify(item),
  });
}

export function serverDeletePharmacyMedication(id: string) {
  return request<{ deleted: boolean }>(`/pharmacy/catalog/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function serverPharmacyOrders() {
  return request<{ orders: any[] }>('/pharmacy/orders');
}

export function serverCreatePharmacyCheckout(input: {
  cartItems: Array<{ id: string; quantity: number }>;
  encounterId?: string;
  insuranceCoverageAmount: number;
  fulfillmentDetails: Record<string, unknown>;
  successUrl: string;
  cancelUrl: string;
}) {
  return request<{ checkoutUrl: string; sessionId: string; orderId: string; total: number }>('/pharmacy/create-checkout-session', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function serverConfirmPharmacyPayment(reference: string, sessionId: string) {
  return request<{ order: any }>(`/pharmacy/orders/${encodeURIComponent(reference)}/confirm-payment`, {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

export function serverUpdatePharmacyOrderStatus(reference: string, status: string) {
  return request<{ order: any }>(`/pharmacy/orders/${encodeURIComponent(reference)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function serverMarkPharmacyOrderReceived(reference: string) {
  return request<{ order: any }>(`/pharmacy/orders/${encodeURIComponent(reference)}/received`, {
    method: 'PATCH',
  });
}