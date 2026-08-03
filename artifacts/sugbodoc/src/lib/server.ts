import { STORAGE_KEYS, type SessionUser } from '@/hooks/use-auth';
import type { Encounter } from '@/lib/encounters';

const base = () => import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${base()}/api${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : `Request failed (${response.status})`);
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