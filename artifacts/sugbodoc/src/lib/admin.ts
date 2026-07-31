import {
  currentPatient,
  doctors,
  upcomingAppointments,
  pastAppointments,
  bills,
  pastBills,
  encounters,
  prescriptions,
  labResults,
  soapNotes,
  diagnoses,
} from '@/data/mock';
import { getCurrentSessionUser, STORAGE_KEYS, type SessionUser } from '@/hooks/use-auth';
import { loadClaims, loadInsurance, type InsuranceClaim, type InsuranceRecord } from '@/lib/insurance';

export const ADMIN_STORAGE_KEYS = {
  patients: 'sugbodoc_admin_patients',
  medications: 'sugbodoc_admin_medications',
  orders: 'sugbodoc_admin_orders',
  payments: 'sugbodoc_admin_payments',
  schedules: 'sugbodoc_admin_schedules',
  audit: 'sugbodoc_admin_audit',
} as const;

export type AdminPatient = SessionUser & {
  id: string;
  status: 'Active' | 'Inactive';
  lastActive: string;
  clinical: {
    appointments: any[];
    encounters: any[];
    soapNotes: any[];
    diagnoses: any[];
    prescriptions: any[];
    labResults: any[];
    bills: any[];
    payments: AdminPayment[];
    medicationOrders: any[];
    insurance: InsuranceRecord | null;
    claims: InsuranceClaim[];
  };
};

export type AdminPayment = {
  id: string;
  patientId: string;
  patientName: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Failed' | 'Refunded';
  reference: string;
  date: string;
  description: string;
};

export type AdminMedication = {
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
  availability: 'Available' | 'Low Stock' | 'Out of Stock' | 'Disabled';
  enabled: boolean;
  partnerLocations: string[];
  updatedAt: string;
};

export type AdminOrder = {
  reference: string;
  patientId: string;
  patientName: string;
  items: any[];
  fulfillmentDetails: any;
  totals: { subtotal: number; estimatedInsuranceCoverage?: number; deliveryFee: number; total: number };
  status: 'Pending' | 'Processing' | 'Ready for Pickup' | 'Out for Delivery' | 'Delivered' | 'Received' | 'Cancelled';
  paymentStatus?: string;
  createdAt: string;
  receivedAt?: string;
};

export type AdminSchedule = {
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

export type AuditEvent = {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
};

const DEFAULT_MEDICATIONS: AdminMedication[] = [
  ['med-001', 'Biogesic', 'Paracetamol for pain and fever relief.', 'Paracetamol', '500mg', 'Tablet', 'Pain Relief', 7.5, 150],
  ['med-002', 'Neozep Forte', 'Multi-symptom cold and flu relief.', 'Phenylephrine HCl + Chlorphenamine Maleate + Paracetamol', '10mg/2mg/500mg', 'Tablet', 'Cold & Flu', 8.25, 200],
  ['med-003', 'Alaxan FR', 'Combination analgesic for muscle pain.', 'Ibuprofen + Paracetamol', '200mg/325mg', 'Capsule', 'Pain Relief', 12, 85],
  ['med-004', 'Solmux', 'Mucolytic for productive cough.', 'Carbocisteine', '500mg', 'Capsule', 'Cough', 15.5, 120],
  ['med-005', 'Amoxil', 'Prescription antibiotic.', 'Amoxicillin', '500mg', 'Capsule', 'Antibiotics', 22, 40],
  ['med-006', 'Diatabs', 'Relief for occasional diarrhea.', 'Loperamide', '2mg', 'Capsule', 'Digestion', 10, 0],
  ['med-007', 'Kremil-S', 'Antacid for heartburn and indigestion.', 'Aluminum Hydroxide + Magnesium Hydroxide + Simeticone', '178mg/233mg/30mg', 'Tablet', 'Digestion', 11.5, 95],
  ['med-008', 'Ascorbic Acid', 'Vitamin C supplement.', 'Vitamin C', '500mg', 'Tablet', 'Vitamins', 5, 500],
  ['med-009', 'Losartan', 'Maintenance medicine for blood pressure.', 'Losartan Potassium', '50mg', 'Tablet', 'Heart Health', 18, 65],
].map(([id, name, description, genericName, dosage, dosageForm, category, price, stock]) => ({
  id: id as string,
  name: name as string,
  description: description as string,
  genericName: genericName as string,
  dosage: dosage as string,
  dosageForm: dosageForm as string,
  form: dosageForm as string,
  category: category as string,
  price: Number(price),
  stock: Number(stock),
  enabled: Number(stock) > 0,
  availability: Number(stock) > 50 ? 'Available' : Number(stock) > 0 ? 'Low Stock' : 'Out of Stock',
  partnerLocations: ['Sugbo Pharmacy Escario', 'Chong Hua Hospital Pharmacy'],
  updatedAt: new Date().toISOString(),
})) as AdminMedication[];

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function users(): Array<SessionUser & { password?: string }> {
  return read(STORAGE_KEYS.USERS, []);
}

function seedPatients(): AdminPatient[] {
  const saved = read<AdminPatient[]>(ADMIN_STORAGE_KEYS.patients, []);
  if (saved.length) return saved;
  const patientUsers = users().filter(user => (user.role ?? 'Patient') !== 'Admin');
  if (!patientUsers.length) {
    patientUsers.push({
      name: currentPatient.name,
      initials: currentPatient.initials,
      email: 'juan@example.com',
      phone: currentPatient.emergencyContact.number,
      birthday: '1991-03-15',
      gender: 'Male',
      bloodType: currentPatient.bloodType,
      role: 'Patient',
      status: 'Active',
    });
  }
  const created = patientUsers.map((user, index) => {
    const id = `pt_${index + 123}`;
    return {
      ...user,
      id,
      role: 'Patient' as const,
      status: user.status ?? 'Active',
      lastActive: new Date().toISOString(),
      clinical: {
        appointments: [...upcomingAppointments, ...pastAppointments],
        encounters,
        soapNotes,
        diagnoses,
        prescriptions,
        labResults,
        bills: [...bills, ...pastBills],
        payments: [],
        medicationOrders: read<AdminOrder[]>('sugbodoc_medication_orders', []),
        insurance: loadInsurance(),
        claims: loadClaims(),
      },
    };
  });
  write(ADMIN_STORAGE_KEYS.patients, created);
  return created;
}

export function loadAdminPatients() {
  return seedPatients();
}

export function saveAdminPatients(patients: AdminPatient[]) {
  write(ADMIN_STORAGE_KEYS.patients, patients);
  const storedUsers = users();
  const updatedUsers = storedUsers.map(user => {
    const patient = patients.find(item => item.email.toLowerCase() === user.email.toLowerCase());
    return patient
      ? { ...user, name: patient.name, initials: patient.initials, phone: patient.phone, status: patient.status, role: patient.role }
      : user;
  });
  write(STORAGE_KEYS.USERS, updatedUsers);
}

export function loadAdminMedications() {
  const saved = read<AdminMedication[]>(ADMIN_STORAGE_KEYS.medications, []);
  if (saved.length) return saved;
  write(ADMIN_STORAGE_KEYS.medications, DEFAULT_MEDICATIONS);
  return DEFAULT_MEDICATIONS;
}

export function saveAdminMedications(items: AdminMedication[]) {
  write(ADMIN_STORAGE_KEYS.medications, items);
}

export function loadAdminOrders() {
  const saved = read<AdminOrder[]>(ADMIN_STORAGE_KEYS.orders, []);
  if (saved.length) return saved;
  const current = read<any[]>('sugbodoc_medication_orders', []);
  const patients = seedPatients();
  const orders = current.map(order => ({
    ...order,
    patientId: patients[0]?.id ?? 'pt_123',
    patientName: patients[0]?.name ?? currentPatient.name,
  })) as AdminOrder[];
  write(ADMIN_STORAGE_KEYS.orders, orders);
  return orders;
}

export function saveAdminOrders(orders: AdminOrder[]) {
  write(ADMIN_STORAGE_KEYS.orders, orders);
  write('sugbodoc_medication_orders', orders);
}

export function loadAdminPayments() {
  const saved = read<AdminPayment[]>(ADMIN_STORAGE_KEYS.payments, []);
  if (saved.length) return saved;
  const patients = seedPatients();
  const patient = patients[0];
  const seeded: AdminPayment[] = [
    { id: 'pay_1001', patientId: patient?.id ?? 'pt_123', patientName: patient?.name ?? currentPatient.name, amount: 800, status: 'Paid', reference: 'pi_test_3N8J2A', date: '2024-07-30', description: 'Consultation - Dr. Maria Santos' },
    { id: 'pay_1002', patientId: patient?.id ?? 'pt_123', patientName: patient?.name ?? currentPatient.name, amount: 3700, status: 'Pending', reference: 'cs_test_8K2P1B', date: '2024-07-30', description: 'Comprehensive Lipid Panel' },
  ];
  write(ADMIN_STORAGE_KEYS.payments, seeded);
  return seeded;
}

export function saveAdminPayments(payments: AdminPayment[]) {
  write(ADMIN_STORAGE_KEYS.payments, payments);
}

export function loadAdminSchedules(): AdminSchedule[] {
  const saved = read<AdminSchedule[]>(ADMIN_STORAGE_KEYS.schedules, []);
  if (saved.length) return saved;
  const seeded = doctors.map((doctor, index) => ({
    id: `schedule_${doctor.id}`,
    doctorId: doctor.id,
    doctorName: doctor.name,
    specialty: doctor.specialty,
    clinic: doctor.clinic,
    day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][index % 5],
    startTime: '09:00',
    endTime: '17:00',
    slots: 8,
    enabled: true,
  }));
  write(ADMIN_STORAGE_KEYS.schedules, seeded);
  return seeded;
}

export function saveAdminSchedules(schedules: AdminSchedule[]) {
  write(ADMIN_STORAGE_KEYS.schedules, schedules);
}

export function loadAuditEvents() {
  return read<AuditEvent[]>(ADMIN_STORAGE_KEYS.audit, []);
}

export function addAuditEvent(action: string, target: string) {
  const actor = getCurrentSessionUser()?.name ?? 'Administrator';
  const events = loadAuditEvents();
  const event = { id: `audit_${Date.now()}`, actor, action, target, timestamp: new Date().toISOString() };
  write(ADMIN_STORAGE_KEYS.audit, [event, ...events].slice(0, 100));
  return event;
}

export function seedAdminData() {
  seedPatients();
  loadAdminMedications();
  loadAdminOrders();
  loadAdminPayments();
  loadAdminSchedules();
}