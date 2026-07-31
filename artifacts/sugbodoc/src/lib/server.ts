import { STORAGE_KEYS, type SessionUser } from '@/hooks/use-auth';

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