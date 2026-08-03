import {
  currentPatient,
  doctors,
  pastAppointments,
  pastBills,
  encounters as legacyEncounters,
  labResults,
  prescriptions,
  diagnoses,
  vitalsData,
} from '@/data/mock';
import { getImagingRecords, getSoapNotes } from '@/lib/clinical';

export const ENCOUNTERS_STORAGE_KEY = 'sugbodoc_encounters';
export const BILLING_RELATIONSHIPS_STORAGE_KEY = 'sugbodoc_encounter_billing';

export type EncounterBilling = {
  consultationFee: number;
  laboratoryCharges: number;
  imagingCharges: number;
  pharmacyCharges: number;
  insuranceCoverage: number;
  payments: Array<{ id: string; amount: number; status: string; reference?: string; date?: string }>;
  relatedBillIds: string[];
};

export type Encounter = {
  id: string;
  encounterReference: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  encounterDate: string;
  date: string;
  doctorId?: string;
  doctor: string;
  specialty: string;
  clinic: string;
  chiefComplaint: string;
  appointmentDetails: {
    date: string;
    time: string;
    status: string;
    reference?: string;
  };
  clinicalSummary: string;
  soapNotes: any[];
  diagnoses: any[];
  prescriptions: any[];
  medications: any[];
  pharmacyOrders: any[];
  bills?: any[];
  vitals: any[];
  laboratoryResults: any[];
  imaging: any[];
  billing: EncounterBilling;
  source?: 'appointment' | 'legacy';
};

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

function slug(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase();
}

function dateValue(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function matchingLegacyRecord(appointment: any, index: number) {
  return legacyEncounters[index] ?? legacyEncounters.find(item => item.date === appointment.date);
}

export function createLegacyEncounters(patient: { id: string; name: string } = { id: currentPatient.id, name: currentPatient.name }): Encounter[] {
  const patientSuffix = slug(patient.id);
  return pastAppointments.map((appointment: any, index) => {
    const legacy = matchingLegacyRecord(appointment, index);
    const doctor = appointment.doctor;
    const soap = getSoapNotes().filter(note => note.date === appointment.date || index === 0);
    const assignedLabs = index === 0 ? labResults : [];
    const assignedPrescriptions = index === 0 ? prescriptions : [];
    const assignedDiagnoses = index === 0 ? diagnoses : [];
    const assignedImaging = getImagingRecords().filter(record => index === 0 ? record.id === 'img_1' : record.id === 'img_2');
    const relatedBills = pastBills.filter(bill => index === 0 ? bill.id === 'bill_3' : bill.id === 'bill_4');
    const encounterId = `enc_${slug(appointment.id)}_${patientSuffix}`;
    return {
      id: encounterId,
      encounterReference: `ENC-${slug(appointment.id)}-${patientSuffix}`,
      appointmentId: appointment.id,
      patientId: patient.id,
      patientName: patient.name,
      encounterDate: dateValue(appointment.date),
      date: appointment.date,
      doctorId: doctor.id,
      doctor: doctor.name,
      specialty: doctor.specialty,
      clinic: doctor.clinic,
      chiefComplaint: legacy?.complaint ?? 'Completed consultation',
      appointmentDetails: { date: appointment.date, time: appointment.time, status: 'Completed', reference: appointment.reference },
      clinicalSummary: legacy?.summary ?? 'Completed consultation with no clinical summary yet.',
      soapNotes: soap.map(note => ({ ...note, encounterId })),
      diagnoses: assignedDiagnoses.map(item => ({ ...item, encounterId })),
      prescriptions: assignedPrescriptions.map(item => ({ ...item, encounterId })),
      medications: assignedPrescriptions.map(item => ({ id: `${item.id}_med`, name: item.name, dosage: item.dosage, encounterId })),
      pharmacyOrders: [],
      vitals: index === 0 ? vitalsData.slice(-1).map(item => ({ ...item, encounterId })) : [],
      laboratoryResults: assignedLabs.map(item => ({ ...item, encounterId })),
      imaging: assignedImaging.map(item => ({ ...item, encounterId })),
      billing: {
        consultationFee: relatedBills.find(bill => bill.description.toLowerCase().includes('consultation'))?.amount ?? 0,
        laboratoryCharges: relatedBills.find(bill => bill.description.toLowerCase().includes('lipid'))?.amount ?? 0,
        imagingCharges: 0,
        pharmacyCharges: 0,
        insuranceCoverage: 0,
        payments: relatedBills.map(bill => ({ id: `${bill.id}_payment`, amount: bill.amount, status: bill.status, reference: bill.receiptId, date: bill.date })),
        relatedBillIds: relatedBills.map(bill => bill.id),
      },
      source: 'legacy',
    };
  });
}

export function loadEncounters(): Encounter[] {
  const saved = read<Encounter[]>(ENCOUNTERS_STORAGE_KEY, []);
  if (saved.length) return saved;
  const seeded = createLegacyEncounters();
  saveEncounters(seeded);
  return seeded;
}

export function createLegacyEncountersForPatient(patient: { id: string; name: string }) {
  return createLegacyEncounters(patient);
}

export function saveEncounters(items: Encounter[]) {
  write(ENCOUNTERS_STORAGE_KEY, items);
  write(BILLING_RELATIONSHIPS_STORAGE_KEY, items.map(item => ({
    encounterId: item.id,
    encounterReference: item.encounterReference,
    billing: item.billing,
  })));
}

export function updateEncounter(encounterId: string, updater: (encounter: Encounter) => Encounter) {
  const updated = loadEncounters().map(item => item.id === encounterId ? updater(item) : item);
  const result = updated.find(item => item.id === encounterId) ?? null;
  saveEncounters(updated);
  return result;
}

export function syncAppointmentStatus(appointment: any) {
  try {
    const current = read<any[]>('sugbodoc_appointments', []);
    if (!current.length) return;
    const next = current.map(item => item.id === appointment.id ? { ...item, ...appointment } : item);
    write('sugbodoc_appointments', next);
  } catch {
    // LocalStorage synchronization is best effort in this prototype.
  }
}

export function attachPharmacyOrderToEncounter(order: any, patientId = currentPatient.id, patientName = currentPatient.name) {
  const encounters = getPatientEncounters(patientId, patientName);
  const encounterId = order.encounterId ?? encounters[0]?.id;
  if (!encounterId) return null;
  return updateEncounter(encounterId, encounter => ({
    ...encounter,
    pharmacyOrders: [...(encounter.pharmacyOrders ?? []).filter((item: any) => item.reference !== order.reference), { ...order, encounterId }],
    billing: {
      ...encounter.billing,
      pharmacyCharges: (encounter.pharmacyOrders ?? []).filter((item: any) => item.reference !== order.reference).reduce((sum: number, item: any) => sum + (item.totals?.total ?? 0), 0) + (order.totals?.total ?? 0),
    },
  }));
}

export function addEncounterRecord(encounterId: string, type: 'soapNotes' | 'diagnoses' | 'prescriptions' | 'laboratoryResults' | 'imaging', record: any) {
  return updateEncounter(encounterId, encounter => ({
    ...encounter,
    [type]: [...(encounter[type] ?? []), { ...record, encounterId }],
  }));
}

export function linkBillingRecordToEncounter(bill: any, payment?: { id: string; amount: number; status: string; reference?: string; date?: string }, patientId = currentPatient.id, patientName = currentPatient.name) {
  const encounter = getPatientEncounters(patientId, patientName)[0];
  if (!encounter) return null;
  return updateEncounter(encounter.id, current => ({
    ...current,
    billing: {
      ...current.billing,
      relatedBillIds: [...new Set([...(current.billing.relatedBillIds ?? []), bill.id])],
      payments: payment
        ? [...(current.billing.payments ?? []).filter(item => item.id !== payment.id), payment]
        : current.billing.payments,
    },
  }));
}

export function getEncounterForAppointment(appointmentId: string) {
  return loadEncounters().find(encounter => encounter.appointmentId === appointmentId);
}

export function createEncounterFromAppointment(appointment: any, patient: { id: string; name: string }, options?: { chiefComplaint?: string }): Encounter | null {
  if (!appointment || appointment.status !== 'Completed') return null;
  const existing = getEncounterForAppointment(appointment.id);
  if (existing) return existing;
  const doctor = appointment.doctor ?? doctors.find(item => item.id === appointment.doctorId) ?? doctors[0];
  const encounterId = `enc_${appointment.id}`;
  const newEncounter: Encounter = {
    id: encounterId,
    encounterReference: `ENC-${slug(appointment.id)}-${Date.now().toString().slice(-4)}`,
    appointmentId: appointment.id,
    patientId: patient.id,
    patientName: patient.name,
    encounterDate: dateValue(appointment.date),
    date: appointment.date,
    doctorId: doctor.id,
    doctor: doctor.name,
    specialty: doctor.specialty,
    clinic: doctor.clinic,
    chiefComplaint: options?.chiefComplaint ?? appointment.chiefComplaint ?? 'Completed consultation',
    appointmentDetails: { date: appointment.date, time: appointment.time, status: appointment.status, reference: appointment.reference },
    clinicalSummary: 'Encounter created from a completed appointment. Clinical records can be added by an authorized clinical user.',
    soapNotes: [],
    diagnoses: [],
    prescriptions: [],
    medications: [],
    pharmacyOrders: [],
    vitals: [],
    laboratoryResults: [],
    imaging: [],
    billing: {
      consultationFee: appointment.billing?.originalAmount ?? 0,
      laboratoryCharges: 0,
      imagingCharges: 0,
      pharmacyCharges: 0,
      insuranceCoverage: appointment.billing?.estimatedInsuranceCoverage ?? 0,
      payments: [],
      relatedBillIds: appointment.billing?.billId ? [appointment.billing.billId] : [],
    },
    source: 'appointment',
  };
  saveEncounters([...loadEncounters(), newEncounter]);
  return newEncounter;
}

export function completeAppointment(appointment: any, patient: { id: string; name: string }) {
  if (!appointment || appointment.status !== 'Confirmed') return null;
  const completed = { ...appointment, status: 'Completed' };
  return createEncounterFromAppointment(completed, patient);
}

export function recordsForEncounter(encounter: Encounter | null) {
  if (!encounter) return {
    soapNotes: [], diagnoses: [], prescriptions: [], medications: [], vitals: [], laboratoryResults: [], imaging: [], clinicalSummary: '',
  };
  return encounter;
}

export function getPatientEncounters(patientId?: string, patientName?: string) {
  return loadEncounters()
    .filter(item => (!patientId || item.patientId === patientId || (Boolean(patientName) && item.patientName === patientName)) && (!patientName || item.patientName === patientName))
    .sort((a, b) => new Date(b.encounterDate).getTime() - new Date(a.encounterDate).getTime());
}

export function getLatestPatientEncounter(patientId = currentPatient.id, patientName = currentPatient.name) {
  return getPatientEncounters(patientId, patientName)[0];
}

export function isClinicalUser(user: { role?: string; clinicalEditingPermission?: boolean } | null) {
  return Boolean(user && (user.role === 'Clinician' || user.clinicalEditingPermission === true));
}