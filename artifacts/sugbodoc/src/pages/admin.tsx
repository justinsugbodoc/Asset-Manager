import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertCircle, ArrowLeft, CalendarDays, Check, ChevronRight, ClipboardList,
  CreditCard, FileCheck2, FileText, Filter, LayoutDashboard, LogOut, Menu, Package,
  MessageSquare, Pencil, Plus, Search, Send, Settings2, ShieldCheck, Stethoscope, Trash2, Truck, Users, X,
  Download, Image as ImageIcon, Maximize2, FlaskConical, HeartPulse, UserRound,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { getCurrentSessionUser, useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import {
  loadAdminMedications, loadAdminOrders, loadAdminPatients, loadAdminPayments,
  type AdminMedication, type AdminOrder, type AdminPatient, type AdminPayment, type AdminSchedule,
} from '@/lib/admin';
import { downloadImagingReport, type ImagingRecord } from '@/lib/clinical';
import { completeAppointment, syncAppointmentStatus, type Encounter } from '@/lib/encounters';
import { createLegacyEncountersForPatient } from '@/lib/encounters';
import {
  serverCreateEncounter,
  serverAdminSchedules,
  serverAuditEvents,
  serverCreateAuditEvent,
  serverDeletePharmacyMedication,
  serverMigrateRecords,
  serverPatients,
  serverPharmacyCatalog,
  serverPharmacyOrders,
  serverSaveAdminSchedules,
  serverRecords,
  serverUpdateAppointmentStatus,
  serverUpdatePatient,
  serverUpdatePharmacyMedication,
  serverUpdatePharmacyOrderStatus,
  serverMarkMessagesRead,
  serverMessageConversations,
  serverMessages,
  serverSendMessage,
  type ServerMessage,
  type ServerMessageConversation,
  type ServerPatient,
} from '@/lib/server';

type Section = 'overview' | 'patients' | 'appointments' | 'messages' | 'payments' | 'medications' | 'orders' | 'claims' | 'reports' | 'audit';
const sectionItems: Array<{ id: Section; label: string; icon: any }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'patients', label: 'Patients', icon: Users },
  { id: 'appointments', label: 'Appointments', icon: CalendarDays },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'payments', label: 'Payments & Billing', icon: CreditCard },
  { id: 'medications', label: 'Pharmacy Inventory', icon: Package },
  { id: 'orders', label: 'Pharmacy Orders', icon: Truck },
  { id: 'claims', label: 'Insurance & Claims', icon: ShieldCheck },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'audit', label: 'Audit Log', icon: ClipboardList },
];

const cardClass = 'rounded-2xl border border-border bg-card shadow-sm';
const inputClass = 'h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';
const money = (amount: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
const orderDateTime = (value: string | undefined) => value
  ? new Date(value).toLocaleString('en-PH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  : '—';
const displayDate = (value: string | undefined) => value
  ? new Date(value).toLocaleDateString('en-PH', { dateStyle: 'medium' })
  : '—';
const badge = (status: string) => {
  if (['Active', 'Paid', 'Approved', 'Received', 'Available', 'Delivered'].includes(status)) return 'bg-emerald-100 text-emerald-800';
  if (['Inactive', 'Denied', 'Cancelled', 'Out of Stock', 'Failed', 'Disabled'].includes(status)) return 'bg-rose-100 text-rose-800';
  return 'bg-amber-100 text-amber-800';
};

function addAuditEvent(action: string, target: string) {
  void serverCreateAuditEvent(action, target);
}

function StatusBadge({ value }: { value: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${badge(value)}`}>{value}</span>;
}

function AdminShell({
  section, onSection, children, onLogout,
}: { section: Section; onSection: (section: Section) => void; children: React.ReactNode; onLogout: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex min-h-[100dvh] bg-slate-50 dark:bg-background">
      <aside className={`${mobileOpen ? 'fixed inset-y-0 left-0 z-50 flex' : 'hidden'} w-72 flex-col border-r border-border bg-card lg:sticky lg:top-0 lg:flex lg:h-screen`}>
        <div className="flex h-16 items-center justify-between border-b border-border px-6">
          <Link href="/admin" className="flex items-center gap-2 font-bold text-primary"><ShieldCheck className="h-6 w-6" /> SugboDoc Admin</Link>
          <button className="lg:hidden" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <div className="border-b border-border bg-primary/5 px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Administrator workspace</p>
          <p className="mt-1 text-xs text-muted-foreground">Shared PostgreSQL operations</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {sectionItems.map(item => (
            <button key={item.id} onClick={() => { onSection(item.id); setMobileOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${section === item.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <item.icon className="h-4 w-4" /> {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <Link href="/" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted"><ArrowLeft className="h-4 w-4" /> Patient portal</Link>
          <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-destructive"><LogOut className="h-4 w-4" /> Sign out</button>
        </div>
      </aside>
      {mobileOpen && <button aria-label="Close admin navigation" className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur lg:px-8">
          <button className="rounded-lg p-2 hover:bg-muted lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button>
          <div className="hidden lg:block"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">SugboDoc</p><p className="font-semibold">Admin Portal</p></div>
          <div className="ml-auto flex items-center gap-3"><span className="hidden text-sm text-muted-foreground sm:inline">Admin mode</span><div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">SA</div></div>
        </header>
        <div className="mx-auto max-w-[1500px] p-4 pb-12 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">{eyebrow}</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p></div>{action}</div>;
}

function Overview({ patients, appointments, payments, medications, orders }: { patients: AdminPatient[]; appointments: any[]; payments: AdminPayment[]; medications: AdminMedication[]; orders: AdminOrder[] }) {
  const claims = patients.flatMap(patient => patient.clinical.claims);
  const metrics: Array<[string, string | number, any, string]> = [
    ['Patients', patients.length, Users, 'text-blue-600 bg-blue-50'],
    ['Appointments', appointments.length, CalendarDays, 'text-violet-600 bg-violet-50'],
    ['Payments', money(payments.filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.amount, 0)), CreditCard, 'text-emerald-600 bg-emerald-50'],
    ['Pharmacy orders', orders.length, Package, 'text-amber-600 bg-amber-50'],
    ['Active claims', claims.filter(c => ['Processing', 'Draft'].includes(c.status)).length, ShieldCheck, 'text-cyan-600 bg-cyan-50'],
    ['Low stock items', medications.filter(m => m.stock <= 50 && m.enabled).length, AlertCircle, 'text-rose-600 bg-rose-50'],
  ];
  return <div className="space-y-6">
    <PageHeading eyebrow="Command center" title="Good morning, Admin" description="A live summary of patient care, operations, payments, pharmacy inventory, and insurance activity." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(([label, value, Icon, color]) => <div key={String(label)} className={`${cardClass} p-5`}><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-muted-foreground">{label as string}</p><p className="mt-2 text-2xl font-bold">{value as string | number}</p></div><div className={`rounded-xl p-3 ${color as string}`}><Icon className="h-5 w-5" /></div></div></div>)}</div>
    <div className="grid gap-6 xl:grid-cols-2">
      <div className={`${cardClass} overflow-hidden`}><div className="flex items-center justify-between border-b border-border p-5"><div><h2 className="font-bold">Recent appointments</h2><p className="text-xs text-muted-foreground">Confirmation and scheduling queue</p></div><CalendarDays className="h-5 w-5 text-primary" /></div><div className="divide-y divide-border">{appointments.slice(0, 5).map((appointment: any) => <div key={appointment.id} className="flex items-center justify-between gap-3 p-4"><div><p className="text-sm font-semibold">{appointment.doctor?.name}</p><p className="text-xs text-muted-foreground">{appointment.date} · {appointment.time}</p></div><StatusBadge value={appointment.status} /></div>)}</div></div>
      <div className={`${cardClass} overflow-hidden`}><div className="flex items-center justify-between border-b border-border p-5"><div><h2 className="font-bold">Operations watchlist</h2><p className="text-xs text-muted-foreground">Items requiring attention</p></div><Activity className="h-5 w-5 text-primary" /></div><div className="space-y-3 p-5"><div className="flex items-center justify-between rounded-xl bg-rose-50 p-3 text-sm"><span className="font-semibold text-rose-800">Low inventory</span><span className="font-bold text-rose-700">{medications.filter(m => m.stock <= 50 && m.enabled).length} items</span></div><div className="flex items-center justify-between rounded-xl bg-amber-50 p-3 text-sm"><span className="font-semibold text-amber-800">Pending payments</span><span className="font-bold text-amber-700">{payments.filter(p => p.status === 'Pending').length}</span></div><div className="flex items-center justify-between rounded-xl bg-blue-50 p-3 text-sm"><span className="font-semibold text-blue-800">Open claims</span><span className="font-bold text-blue-700">{claims.filter(c => c.status === 'Processing').length}</span></div></div></div>
    </div>
  </div>;
}

function AdminPatientRecords({ patient, payments, orders, onBack }: { patient: AdminPatient; payments: AdminPayment[]; orders: AdminOrder[]; onBack: () => void }) {
  const [encounters, setEncounters] = useState<Encounter[]>(() => patient.clinical.encounters as Encounter[]);
  const [selectedEncounterId, setSelectedEncounterId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    serverRecords(patient.id)
      .then(response => {
        if (!active) return;
        setEncounters(response.encounters as Encounter[]);
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load this patient record.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [patient.id]);

  const completedAppointmentIds = new Set(
    patient.clinical.appointments
      .filter(appointment => appointment.status === 'Completed')
      .map(appointment => appointment.id),
  );
  const completedEncounters = encounters.filter(encounter =>
    (encounter.appointmentId && completedAppointmentIds.has(encounter.appointmentId))
    || encounter.appointmentDetails?.status === 'Completed',
  );
  const selectedEncounter = completedEncounters.find(item => item.id === selectedEncounterId) ?? completedEncounters[0];
  const selectedOrders = selectedEncounter
    ? [
        ...orders.filter(order => order.patientId === patient.id && order.encounterId === selectedEncounter.id),
        ...((selectedEncounter.pharmacyOrders ?? []) as any[]).map(order => ({
          ...order,
          patientId: patient.id,
          encounterId: selectedEncounter.id,
        })),
      ].filter((order, index, all) => all.findIndex(item => item.reference === order.reference) === index)
    : [];
  const selectedPayments = selectedEncounter
    ? [
        ...((selectedEncounter.payments ?? []) as any[]).map(payment => ({
          ...payment,
          patientId: patient.id,
          patientName: patient.name,
          encounterId: selectedEncounter.id,
          encounterReference: selectedEncounter.encounterReference,
        })),
        ...(selectedEncounter.billing?.payments ?? []).map(payment => ({
          ...payment,
          patientId: patient.id,
          patientName: patient.name,
          encounterId: selectedEncounter.id,
          encounterReference: selectedEncounter.encounterReference,
        })),
        ...payments.filter(payment => payment.patientId === patient.id && (payment as any).encounterId === selectedEncounter.id),
      ].filter((payment, index, all) => all.findIndex(item => (item.id && item.id === payment.id) || (item.reference && item.reference === payment.reference)) === index)
    : [];
  const selectedBills = selectedEncounter?.bills ?? [];

  useEffect(() => {
    if (selectedEncounter && selectedEncounter.id !== selectedEncounterId) {
      setSelectedEncounterId(selectedEncounter.id);
    }
  }, [selectedEncounter, selectedEncounterId]);

  const summary = (value: unknown) => typeof value === 'string' && value.trim() ? value : '—';
  const insurance = patient.insurance as Record<string, unknown> | null | undefined;
  const emergencyContact = patient.emergencyContact;
  const recordScope = <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">Encounter-scoped</span>;
  const empty = (text: string) => <EmptyState text={text} />;
  const table = (columns: string[], rows: any[][], text: string) => rows.length ? <SimpleTable columns={columns} rows={rows} /> : empty(text);
  const paymentDescription = (payment: any) =>
    payment.description
    ?? payment.billDescription
    ?? (payment.orderReference ? `Pharmacy order ${payment.orderReference}` : undefined)
    ?? payment.reference
    ?? 'Payment';
  const paymentDate = (payment: any) => displayDate(payment.paymentDate ?? payment.date ?? payment.createdAt);

  const renderRecords = () => {
    if (loading) {
      return <div className="space-y-4">{Array.from({ length: 3 }, (_, index) => <div key={`record-skeleton-${index}`} className={`${cardClass} h-36 animate-pulse bg-muted/40`} />)}</div>;
    }
    if (error) return <div className={`${cardClass} p-6`}>{empty(error)}</div>;
    if (!selectedEncounter) return <div className={`${cardClass} p-6`}>{empty('No completed appointment has a clinical encounter yet.')}</div>;

    const billing = selectedEncounter.billing ?? {} as any;
    const prescriptions = [...selectedEncounter.prescriptions, ...selectedEncounter.medications];
    return <div className="space-y-5">
      <section className={`${cardClass} p-5`}>
        <div className="flex items-center gap-2"><HeartPulse className="h-5 w-5 text-primary" /><h2 className="font-bold">Vitals</h2>{recordScope}</div>
        <div className="mt-4">{table(['Date', 'Blood pressure', 'Heart rate', 'Temperature', 'Weight'], selectedEncounter.vitals.map((vital: any) => [vital.date, vital.systolic != null ? `${vital.systolic}/${vital.diastolic} mmHg` : '—', vital.heartRate ? `${vital.heartRate} bpm` : '—', vital.temp ? `${vital.temp} °C` : '—', vital.weight ? `${vital.weight} kg` : '—']), 'No vitals are recorded for this encounter.')}</div>
      </section>
      <section className={`${cardClass} p-5`}>
        <div className="flex items-center gap-2"><Stethoscope className="h-5 w-5 text-primary" /><h2 className="font-bold">SOAP Notes</h2>{recordScope}<span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-800">Read-only</span></div>
        {selectedEncounter.soapNotes.length ? <div className="mt-4 space-y-4">{selectedEncounter.soapNotes.map((note: any) => <div key={note.id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3"><div><p className="font-bold">{note.doctor}</p><p className="text-xs text-muted-foreground">{note.date} · {note.consultationReference}</p></div><StatusBadge value={note.status ?? 'Signed'} /></div><div className="mt-4 grid gap-3 md:grid-cols-2"><SoapSection title="Subjective" text={note.subjective} /><SoapSection title="Objective" text={note.objective} /><SoapSection title="Assessment" text={note.assessment} /><SoapSection title="Plan" text={note.plan} /></div></div>)}</div> : <div className="mt-4">{empty('No SOAP notes are recorded for this encounter.')}</div>}
      </section>
      <section className={`${cardClass} p-5`}><div className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /><h2 className="font-bold">Diagnoses</h2>{recordScope}</div><div className="mt-4">{table(['Code', 'Description', 'Status', 'Date'], selectedEncounter.diagnoses.map((diagnosis: any) => [diagnosis.code ?? '—', diagnosis.description ?? '—', diagnosis.status ?? '—', diagnosis.date ?? '—']), 'No diagnoses are recorded for this encounter.')}</div></section>
      <section className={`${cardClass} p-5`}><div className="flex items-center gap-2"><PillIcon className="h-5 w-5 text-primary" /><h2 className="font-bold">Prescriptions</h2>{recordScope}</div><div className="mt-4">{table(['Medication', 'Dosage', 'Instructions', 'Status'], prescriptions.map((prescription: any) => [prescription.name ?? '—', prescription.dosage ?? '—', prescription.instructions ?? '—', prescription.status ?? '—']), 'No prescriptions are recorded for this encounter.')}</div></section>
      <section className={`${cardClass} p-5`}><div className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-primary" /><h2 className="font-bold">Laboratory Results</h2>{recordScope}</div><div className="mt-4">{table(['Test', 'Result', 'Reference range', 'Date', 'Status'], selectedEncounter.laboratoryResults.map((lab: any) => [lab.test ?? '—', lab.result ?? '—', lab.range ?? '—', lab.date ?? '—', lab.status ?? '—']), 'No laboratory results are recorded for this encounter.')}</div></section>
      <AdminImagingList records={(selectedEncounter.imaging ?? []) as ImagingRecord[]} />
      <section className={`${cardClass} p-5`}><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /><h2 className="font-bold">Encounter Billing</h2>{recordScope}</div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[['Consultation fee', billing.consultationFee], ['Laboratory charges', billing.laboratoryCharges], ['Imaging charges', billing.imagingCharges], ['Pharmacy charges', billing.pharmacyCharges], ['Insurance coverage', billing.insuranceCoverage], ['Payments', selectedPayments.reduce((sum, payment: any) => sum + Number(payment.amount ?? 0), 0)]].map(([label, amount]) => <div key={String(label)} className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-bold">{money(Number(amount ?? 0))}</p></div>)}</div><div className="mt-4">{table(['Description', 'Bill date', 'Amount', 'Status', 'Bill reference'], selectedBills.map((bill: any) => [bill.description ?? '—', displayDate(bill.date), money(Number(bill.amount ?? 0)), bill.status ?? '—', bill.id ?? '—']), 'No bills are linked to this encounter.')}</div></section>
      <section className={`${cardClass} p-5`}><div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /><h2 className="font-bold">Payments</h2>{recordScope}</div><div className="mt-4">{table(['Description', 'Payment date', 'Amount', 'Reference', 'Status'], selectedPayments.map((payment: any) => [paymentDescription(payment), paymentDate(payment), money(Number(payment.amount ?? 0)), payment.reference ?? '—', payment.status ?? '—']), 'No payments are linked to this encounter.')}</div></section>
      <section className={`${cardClass} p-5`}><div className="flex items-center gap-2"><Truck className="h-5 w-5 text-primary" /><h2 className="font-bold">Pharmacy Orders</h2>{recordScope}</div><div className="mt-4">{table(['Order', 'Order date', 'Fulfillment', 'Payment', 'Amount', 'Received'], selectedOrders.map(order => [order.reference, orderDateTime(order.createdAt), order.fulfillmentDetails?.mode === 'delivery' ? 'Delivery' : 'Pickup', order.paymentStatus ?? '—', money(Number((order as any).paymentAmount ?? order.totals?.total ?? 0)), order.receivedAt ? orderDateTime(order.receivedAt) : 'Not confirmed']), 'No pharmacy orders are linked to this encounter.')}</div></section>
    </div>;
  };

  return <div className="space-y-5">
    <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> Back to patient list</button>
    <section className={`${cardClass} overflow-hidden`}>
      <div className="bg-gradient-to-br from-primary/10 via-card to-card p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground">{patient.initials}</div><div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold uppercase tracking-widest text-primary">Patient records</p><StatusBadge value={patient.status} /></div><h1 className="mt-1 text-2xl font-bold">{patient.name}</h1><p className="mt-1 text-sm text-muted-foreground">Patient ID: <span className="font-mono">{patient.id}</span> · Last active {displayDate(patient.lastActive)}</p></div></div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"><strong>Read-only clinical access</strong><br />Editing requires explicit clinical permission.</div>
        </div>
        <div className="mt-5 grid gap-3 rounded-xl bg-background/70 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><Info label="Email" value={summary(patient.email)} /><Info label="Phone" value={summary(patient.phone)} /><Info label="Birthday" value={summary(patient.birthday)} /><Info label="Gender / blood type" value={`${summary(patient.gender)} · ${summary(patient.bloodType)}`} /></div>
      </div>
      <div className="grid gap-5 border-t border-border p-5 lg:grid-cols-2"><div><div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><h2 className="font-bold">Insurance</h2></div>{insurance ? <div className="grid gap-3 text-sm sm:grid-cols-2"><Info label="Provider" value={summary(insurance.provider)} /><Info label="Plan" value={summary(insurance.plan)} /><Info label="Member number" value={summary(insurance.memberNumber)} /><Info label="Expiration" value={summary(insurance.expirationDate)} /></div> : <p className="text-sm text-muted-foreground">No insurance record saved.</p>}</div><div><div className="mb-3 flex items-center gap-2"><UserRound className="h-4 w-4 text-primary" /><h2 className="font-bold">Emergency contact</h2></div>{emergencyContact ? <div className="grid gap-3 text-sm sm:grid-cols-2"><Info label="Name" value={summary(emergencyContact.name)} /><Info label="Phone" value={summary(emergencyContact.number)} /></div> : <p className="text-sm text-muted-foreground">No emergency contact saved.</p>}</div></div>
    </section>
    <section className={`${cardClass} p-5`}><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">Completed appointments</p><h2 className="mt-1 text-xl font-bold">Encounter history</h2><p className="mt-1 text-sm text-muted-foreground">Select a completed appointment to view only the records connected to it.</p></div><select aria-label="Select completed encounter" value={selectedEncounter?.id ?? ''} onChange={event => setSelectedEncounterId(event.target.value)} className={`${inputClass} lg:w-96`}><option value="">Select completed encounter</option>{completedEncounters.map(encounter => <option key={encounter.id} value={encounter.id}>{encounter.encounterReference} · {encounter.date}</option>)}</select></div>{selectedEncounter && <div className="mt-4 grid gap-3 rounded-xl bg-muted/40 p-4 text-sm sm:grid-cols-3"><Info label="Encounter" value={selectedEncounter.encounterReference} /><Info label="Attending doctor" value={`${selectedEncounter.doctor} · ${selectedEncounter.specialty}`} /><Info label="Appointment" value={`${summary(selectedEncounter.appointmentDetails?.date)} · ${summary(selectedEncounter.appointmentDetails?.time)}`} /></div>}</section>
     <section className={`${cardClass} overflow-hidden`}><div className="border-b border-border bg-muted/30 p-4"><p className="text-xs font-bold uppercase tracking-widest text-primary">Complete encounter record</p><p className="mt-1 text-sm text-muted-foreground">All clinical, billing, payment, and pharmacy details are shown on this page.</p></div><div className="p-5">{renderRecords()}</div></section>
  </div>;
}

function PillIcon(props: React.ComponentProps<typeof Package>) {
  return <Package {...props} />;
}

function Patients({ patients, loading, onSelect }: { patients: AdminPatient[]; loading: boolean; onSelect: (patient: AdminPatient) => void }) {
  const [query, setQuery] = useState(''); const [status, setStatus] = useState('All'); const [page, setPage] = useState(1);
  const filtered = patients.filter(p => `${p.name} ${p.email} ${p.id}`.toLowerCase().includes(query.toLowerCase()) && (status === 'All' || p.status === status));
  const pageSize = 6; const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize)); const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const changeQuery = (value: string) => { setQuery(value); setPage(1); }; const changeStatus = (value: string) => { setStatus(value); setPage(1); };
  return <div className="space-y-5"><PageHeading eyebrow="Patient management" title="Patient records" description="Search the shared patient directory, then open a complete read-only record organized around completed encounters." /><div className={`${cardClass} p-4`}><div className="grid gap-3 md:grid-cols-[1fr_180px]"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input value={query} onChange={e => changeQuery(e.target.value)} placeholder="Search by name, email, or patient ID" className={`${inputClass} pl-9`} /></div><select value={status} onChange={e => changeStatus(e.target.value)} className={inputClass}><option value="All">All account statuses</option><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div></div><div className={`${cardClass} overflow-hidden`}><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-4">Patient</th><th className="px-5 py-4">Patient ID</th><th className="px-5 py-4">Email</th><th className="px-5 py-4">Account status</th><th className="px-5 py-4">Action</th></tr></thead><tbody className="divide-y divide-border">{loading ? Array.from({ length: 5 }, (_, index) => <tr key={`patient-skeleton-${index}`}><td className="px-5 py-5"><div className="h-4 w-40 animate-pulse rounded bg-muted" /></td><td className="px-5 py-5"><div className="h-4 w-24 animate-pulse rounded bg-muted" /></td><td className="px-5 py-5"><div className="h-4 w-48 animate-pulse rounded bg-muted" /></td><td className="px-5 py-5"><div className="h-6 w-16 animate-pulse rounded-full bg-muted" /></td><td className="px-5 py-5"><div className="h-4 w-20 animate-pulse rounded bg-muted" /></td></tr>) : visible.map(patient => <tr key={patient.id} className="hover:bg-muted/30"><td className="px-5 py-4"><button onClick={() => { onSelect(patient); addAuditEvent('Viewed patient profile', patient.name); }} className="flex items-center gap-3 text-left hover:text-primary"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{patient.initials}</span><span className="font-bold">{patient.name}</span></button></td><td className="px-5 py-4 font-mono text-xs text-muted-foreground">{patient.id}</td><td className="px-5 py-4 text-muted-foreground">{patient.email}</td><td className="px-5 py-4"><StatusBadge value={patient.status} /></td><td className="px-5 py-4"><button onClick={() => onSelect(patient)} className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">Open record <ChevronRight className="h-3 w-3" /></button></td></tr>)}</tbody></table>{!loading && !filtered.length && <EmptyState text="No patients match your filters." />}</div><div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground"><span>Showing {visible.length} of {filtered.length} patients</span><div className="flex items-center gap-2"><button disabled={page === 1} onClick={() => setPage(current => current - 1)} className="rounded-lg border border-border px-3 py-1.5 font-bold disabled:opacity-40">Previous</button><span>Page {page} of {pageCount}</span><button disabled={page === pageCount} onClick={() => setPage(current => current + 1)} className="rounded-lg border border-border px-3 py-1.5 font-bold disabled:opacity-40">Next</button></div></div></div></div>;
}

function Appointments({ patients, schedules, onSchedules, onPatients }: { patients: AdminPatient[]; schedules: AdminSchedule[]; onSchedules: (value: AdminSchedule[]) => void; onPatients: (value: AdminPatient[]) => void }) {
  const [filter, setFilter] = useState('All');
  const entries = patients.flatMap(patient => patient.clinical.appointments.map(appointment => ({ ...appointment, patient })));
  const filtered = entries.filter(item => filter === 'All' || item.status === filter);
  const update = async (entry: any, status: string) => {
    if (status === 'Completed' && entry.status !== 'Confirmed') return;
    const encounter = status === 'Completed' ? completeAppointment(entry, entry.patient) : null;
    let sharedEncounter = encounter;
    if (encounter) {
      const billId = `bill_${entry.id}`;
      const consultationFee = Number(entry.billing?.originalAmount ?? encounter.billing.consultationFee ?? 0);
      const estimatedCoverage = Number(entry.billing?.estimatedInsuranceCoverage ?? encounter.billing.insuranceCoverage ?? 0);
      const patientBalance = Number(entry.billing?.patientBalance ?? Math.max(0, consultationFee - estimatedCoverage));
      const consultationBill = {
        id: billId,
        description: `Consultation - ${entry.doctor?.name ?? encounter.doctor}`,
        date: entry.date,
        amount: consultationFee,
        originalAmount: consultationFee,
        estimatedInsuranceCoverage: estimatedCoverage,
        patientBalance,
        status: 'Pending',
        encounterId: encounter.id,
        encounterReference: encounter.encounterReference,
      };
      sharedEncounter = {
        ...encounter,
        bills: [consultationBill],
        billing: {
          ...encounter.billing,
          consultationFee,
          insuranceCoverage: estimatedCoverage,
          relatedBillIds: [...new Set([...(encounter.billing.relatedBillIds ?? []), billId])],
        },
      };
      try {
        sharedEncounter = (await serverCreateEncounter(sharedEncounter)).encounter;
      } catch {
        return;
      }
    }
    onPatients(patients.map(patient => patient.id === entry.patient.id
      ? { ...patient, clinical: { ...patient.clinical, appointments: patient.clinical.appointments.map((appointment: any) => appointment.id === entry.id ? { ...appointment, status } : appointment), encounters: sharedEncounter ? [...patient.clinical.encounters.filter((item: any) => item.appointmentId !== entry.id), sharedEncounter] : patient.clinical.encounters, bills: sharedEncounter?.bills ? [...patient.clinical.bills.filter((bill: any) => bill.encounterId !== sharedEncounter?.id), ...sharedEncounter.bills] : patient.clinical.bills } }
      : patient));
    syncAppointmentStatus({ ...entry, status });
    void serverUpdateAppointmentStatus(entry.id, status).catch(() => undefined);
    addAuditEvent(`Marked appointment ${status.toLowerCase()}`, `${entry.patient.name} · ${entry.doctor?.name ?? 'Provider'}`);
    if (sharedEncounter) addAuditEvent('Linked completed appointment to encounter', sharedEncounter.encounterReference);
  };
  return <div className="space-y-5"><PageHeading eyebrow="Care operations" title="Appointments & schedules" description="Manage provider availability and appointment status across the patient portal." action={<select value={filter} onChange={e => setFilter(e.target.value)} className={inputClass + ' w-auto'}><option>All</option><option>Confirmed</option><option>Pending</option><option>Completed</option><option>Cancelled</option><option>Rescheduled</option></select>} /><div className={`${cardClass} p-5`}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold">Doctor schedules</h2><p className="text-xs text-muted-foreground">Availability used by booking operations</p></div><button onClick={() => onSchedules([...schedules, { id: `schedule_${Date.now()}`, doctorId: 'dr_custom', doctorName: 'New Doctor', specialty: 'Internal Medicine', clinic: 'SugboDoc Main Clinic', day: 'Monday', startTime: '09:00', endTime: '17:00', slots: 8, enabled: true }])} className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"><Plus className="mr-1 inline h-3 w-3" /> Add schedule</button></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{schedules.map(schedule => <div key={schedule.id} className="rounded-xl border border-border p-4"><div className="flex justify-between"><p className="font-semibold">{schedule.doctorName}</p><StatusBadge value={schedule.enabled ? 'Active' : 'Disabled'} /></div><p className="mt-1 text-xs text-muted-foreground">{schedule.specialty} · {schedule.clinic}</p><p className="mt-3 text-sm">{schedule.day} · {schedule.startTime}–{schedule.endTime} · {schedule.slots} slots</p><div className="mt-3 flex flex-wrap gap-3"><button onClick={() => { const doctorName = window.prompt('Doctor name', schedule.doctorName) ?? schedule.doctorName; const specialty = window.prompt('Specialty', schedule.specialty) ?? schedule.specialty; const clinic = window.prompt('Clinic', schedule.clinic) ?? schedule.clinic; const day = window.prompt('Day of week', schedule.day) ?? schedule.day; const startTime = window.prompt('Start time (HH:MM)', schedule.startTime) ?? schedule.startTime; const endTime = window.prompt('End time (HH:MM)', schedule.endTime) ?? schedule.endTime; const slots = Number(window.prompt('Available time slots', String(schedule.slots)) ?? schedule.slots); onSchedules(schedules.map(s => s.id === schedule.id ? { ...s, doctorName, specialty, clinic, day, startTime, endTime, slots: Number.isFinite(slots) ? slots : schedule.slots } : s)); addAuditEvent('Updated doctor schedule', doctorName); }} className="text-xs font-bold text-primary hover:underline">Edit provider & slots</button><button onClick={() => onSchedules(schedules.map(s => s.id === schedule.id ? { ...s, enabled: !s.enabled } : s))} className="text-xs font-bold text-primary hover:underline">{schedule.enabled ? 'Disable' : 'Enable'} schedule</button></div></div>)}</div></div><div className={`${cardClass} overflow-hidden`}><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-4">Patient</th><th className="px-5 py-4">Provider</th><th className="px-5 py-4">Date & time</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Actions</th></tr></thead><tbody className="divide-y divide-border">{filtered.map(entry => <tr key={`${entry.patient.id}-${entry.id}`}><td className="px-5 py-4 font-semibold">{entry.patient.name}</td><td className="px-5 py-4">{entry.doctor?.name}</td><td className="px-5 py-4 text-muted-foreground">{entry.date}<br />{entry.time}</td><td className="px-5 py-4"><StatusBadge value={entry.status} />{entry.status === 'Completed' && <p className="mt-1 text-[10px] text-emerald-700">Encounter linked</p>}</td><td className="px-5 py-4"><div className="flex flex-wrap gap-2">{entry.status === 'Confirmed' && <button key="Completed" onClick={() => update(entry, 'Completed')} className="rounded-lg bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground hover:bg-primary/90">Mark Completed</button>}{['Confirmed', 'Rescheduled', 'Cancelled'].map(action => <button key={action} onClick={() => update(entry, action)} className="rounded-lg border border-border px-2 py-1 text-[10px] font-bold hover:bg-muted">{action}</button>)}</div></td></tr>)}</tbody></table></div></div></div>;
}

function Payments({ payments }: { payments: AdminPayment[] }) {
  const [query, setQuery] = useState(''); const [status, setStatus] = useState('All');
  const filtered = payments.filter(p => `${p.patientName} ${p.reference} ${p.description}`.toLowerCase().includes(query.toLowerCase()) && (status === 'All' || p.status === status));
  return <div className="space-y-5"><PageHeading eyebrow="Stripe Test Mode" title="Payments & billing" description="Monitor test transactions, payment status, amounts, and related patients." /><div className="grid gap-3 md:grid-cols-[1fr_180px]"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search patient, reference, or description" className={`${inputClass} pl-9`} /></div><select value={status} onChange={e => setStatus(e.target.value)} className={inputClass}><option>All</option><option>Paid</option><option>Pending</option><option>Failed</option><option>Refunded</option></select></div><div className={`${cardClass} overflow-hidden`}><div className="flex items-center gap-2 border-b border-border bg-amber-50 p-4 text-xs text-amber-900"><AlertCircle className="h-4 w-4" /> Payment status is synchronized from Stripe verification and PostgreSQL billing records.</div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-4">Patient</th><th className="px-5 py-4">Bill / order</th><th className="px-5 py-4">Amount</th><th className="px-5 py-4">Payment date</th><th className="px-5 py-4">Stripe reference</th><th className="px-5 py-4">Fulfillment</th><th className="px-5 py-4">Status</th></tr></thead><tbody className="divide-y divide-border">{filtered.map(payment => <tr key={payment.id}><td className="px-5 py-4 font-semibold">{payment.patientName}</td><td className="px-5 py-4 text-muted-foreground">{payment.description}<br /><span className="text-xs">{payment.billId ? `Bill ${payment.billId}` : 'Clinical bill'}{payment.orderReference ? ` · Order ${payment.orderReference}` : ''}</span></td><td className="px-5 py-4 font-bold">{money(payment.amount)}</td><td className="px-5 py-4 text-xs text-muted-foreground">{orderDateTime(payment.date)}</td><td className="px-5 py-4 font-mono text-xs">{payment.stripeReference ?? payment.reference}</td><td className="px-5 py-4 text-xs text-muted-foreground">{payment.fulfillmentStatus ?? '—'}{payment.receivedAt ? <><br />Received {orderDateTime(payment.receivedAt)}</> : ''}</td><td className="px-5 py-4"><StatusBadge value={payment.status} /></td></tr>)}</tbody></table>{!filtered.length && <EmptyState text="No payments match your filters." />}</div></div></div>;
}

function Medications({ medications, onMedications }: { medications: AdminMedication[]; onMedications: (value: AdminMedication[]) => void }) {
  const [query, setQuery] = useState(''); const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<AdminMedication | null>(null);
  const filtered = medications.filter(m => `${m.name} ${m.genericName} ${m.category}`.toLowerCase().includes(query.toLowerCase()));
  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const stock = Number(data.get('stock'));
    const next: AdminMedication = {
      id: editing?.id ?? `med_${Date.now()}`,
      name: String(data.get('name')),
      description: String(data.get('description')),
      genericName: String(data.get('genericName')),
      dosage: String(data.get('dosage')),
      dosageForm: String(data.get('dosageForm')),
      form: String(data.get('dosageForm')),
      category: String(data.get('category')),
      price: Number(data.get('price')),
      stock,
      enabled: stock > 0,
      availability: stock > 50 ? 'Available' : stock > 0 ? 'Low Stock' : 'Out of Stock',
      partnerLocations: editing?.partnerLocations ?? ['Sugbo Pharmacy Escario'],
      updatedAt: new Date().toISOString(),
    };
    void serverUpdatePharmacyMedication(next)
      .then(({ medication }) => {
        onMedications(editing ? medications.map(m => m.id === editing.id ? medication as AdminMedication : m) : [medication as AdminMedication, ...medications]);
        addAuditEvent(editing ? 'Updated medication inventory' : 'Added medication', next.name);
        setEditing(null);
        setShowForm(false);
      })
      .catch(error => {
        addAuditEvent('Pharmacy inventory update failed', next.name);
        window.alert(error instanceof Error ? error.message : 'Unable to save medication inventory.');
      });
  };
  const persist = (item: AdminMedication) => {
    void serverUpdatePharmacyMedication(item).then(({ medication }) => onMedications(medications.map(m => m.id === item.id ? medication as AdminMedication : m))).catch(error => window.alert(error instanceof Error ? error.message : 'Unable to save inventory.'));
  };
  return <div className="space-y-5"><PageHeading eyebrow="Pharmacy operations" title="Medication inventory" description="Add, edit, restock, disable, or remove medicines shown in the patient Medication page." action={<button onClick={() => { setEditing(null); setShowForm(true); }} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><Plus className="mr-1 inline h-4 w-4" /> Add medication</button>} />{showForm && <form onSubmit={save} className={`${cardClass} grid gap-4 p-5 md:grid-cols-2`}><h2 className="md:col-span-2 font-bold">{editing ? 'Edit medication' : 'Add new medication'}</h2><Field name="name" label="Medication name" defaultValue={editing?.name} required /><Field name="genericName" label="Generic name" defaultValue={editing?.genericName} required /><Field name="description" label="Description" defaultValue={editing?.description} required /><Field name="dosage" label="Dosage" defaultValue={editing?.dosage} required /><Field name="dosageForm" label="Dosage form" defaultValue={editing?.dosageForm} required /><Field name="category" label="Category" defaultValue={editing?.category} required /><Field name="price" label="Price (PHP)" type="number" step="0.01" defaultValue={editing?.price} required /><Field name="stock" label="Stock quantity" type="number" defaultValue={editing?.stock} required /><div className="flex gap-2 md:col-span-2"><button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><Check className="mr-1 inline h-4 w-4" /> Save</button><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold">Cancel</button></div></form>}<div className={`${cardClass} overflow-hidden`}><div className="border-b border-border p-4"><div className="relative max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search inventory" className={`${inputClass} pl-9`} /></div></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-4">Medication</th><th className="px-5 py-4">Category / form</th><th className="px-5 py-4">Price</th><th className="px-5 py-4">Stock</th><th className="px-5 py-4">Availability</th><th className="px-5 py-4">Actions</th></tr></thead><tbody className="divide-y divide-border">{filtered.map(med => <tr key={med.id}><td className="px-5 py-4"><p className="font-bold">{med.name}</p><p className="text-xs text-muted-foreground">{med.genericName}</p></td><td className="px-5 py-4 text-muted-foreground">{med.category}<br />{med.dosage} · {med.form}</td><td className="px-5 py-4 font-bold">{money(med.price)}</td><td className="px-5 py-4"><input type="number" min="0" value={med.stock} onChange={e => { const stock = Number(e.target.value); const next = { ...med, stock, enabled: stock > 0 && med.enabled, availability: !med.enabled ? 'Disabled' : stock > 50 ? 'Available' : stock > 0 ? 'Low Stock' : 'Out of Stock' } as AdminMedication; onMedications(medications.map(m => m.id === med.id ? next : m)); }} onBlur={e => { const stock = Number(e.currentTarget.value); persist({ ...med, stock, enabled: stock > 0 && med.enabled, availability: !med.enabled ? 'Disabled' : stock > 50 ? 'Available' : stock > 0 ? 'Low Stock' : 'Out of Stock' }); }} className="h-8 w-20 rounded-lg border border-border bg-background px-2 text-xs" /></td><td className="px-5 py-4"><StatusBadge value={med.enabled ? med.availability : 'Disabled'} /></td><td className="px-5 py-4"><div className="flex flex-wrap gap-1.5"><button onClick={() => { setEditing(med); setShowForm(true); }} className="rounded-lg border border-border p-2 hover:bg-muted" title="Edit"><Pencil className="h-3.5 w-3.5" /></button><button onClick={() => persist({ ...med, enabled: !med.enabled, availability: !med.enabled ? (med.stock > 50 ? 'Available' : med.stock > 0 ? 'Low Stock' : 'Out of Stock') : 'Disabled' })} className="rounded-lg border border-border px-2 py-1.5 text-[10px] font-bold">{med.enabled ? 'Disable' : 'Enable'}</button><button onClick={() => { if (window.confirm(`Remove ${med.name}?`)) { void serverDeletePharmacyMedication(med.id).then(() => { onMedications(medications.filter(m => m.id !== med.id)); addAuditEvent('Removed medication', med.name); }).catch(error => window.alert(error instanceof Error ? error.message : 'Unable to remove medication.')); } }} className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50" title="Remove"><Trash2 className="h-3.5 w-3.5" /></button></div></td></tr>)}</tbody></table>{!filtered.length && <EmptyState text="No medications match your search." />}</div></div></div>;
}

function Orders({ orders, patients, onOrders }: { orders: AdminOrder[]; patients: AdminPatient[]; onOrders: (value: AdminOrder[]) => void }) {
  const update = (order: AdminOrder, status: AdminOrder['status']) => {
    void serverUpdatePharmacyOrderStatus(order.reference, status)
      .then(({ order: updated }) => {
        onOrders(orders.map(item => item.reference === order.reference ? { ...item, ...updated } : item));
        addAuditEvent('Updated pharmacy order status', order.reference);
      })
      .catch(error => window.alert(error instanceof Error ? error.message : 'Unable to update pharmacy order.'));
  };
  return <div className="space-y-5"><PageHeading eyebrow="Pharmacy fulfillment" title="Pharmacy Orders" description="Update delivery or pickup progress and see whether patients confirmed receipt." /><div className={`${cardClass} overflow-hidden`}><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-4">Order / bill</th><th className="px-5 py-4">Patient</th><th className="px-5 py-4">Order date & time</th><th className="px-5 py-4">Fulfillment</th><th className="px-5 py-4">Amount</th><th className="px-5 py-4">Payment</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Received</th></tr></thead><tbody className="divide-y divide-border">{orders.map(order => <tr key={order.reference}><td className="px-5 py-4 font-mono text-xs font-bold">{order.reference}<br /><span className="font-normal text-muted-foreground">{order.billReference ?? (order as any).billId ?? 'No bill'}</span></td><td className="px-5 py-4 font-semibold">{order.patientName || patients.find(p => p.id === order.patientId)?.name || '—'}</td><td className="px-5 py-4 text-muted-foreground whitespace-nowrap">{orderDateTime(order.createdAt)}</td><td className="px-5 py-4 text-muted-foreground">{order.fulfillmentDetails?.mode === 'delivery' ? 'Delivery' : 'Pickup'}<br /><span className="text-xs">{order.fulfillmentDetails?.location || order.fulfillmentDetails?.address || '—'}</span></td><td className="px-5 py-4 font-bold">{money((order as any).paymentAmount ?? order.totals?.total ?? 0)}</td><td className="px-5 py-4 text-xs"><StatusBadge value={order.paymentStatus ?? 'pending'} /><br /><span className="font-mono text-[10px]">{order.paymentReference ?? '—'}</span></td><td className="px-5 py-4"><select value={order.status} onChange={e => update(order, e.target.value as AdminOrder['status'])} className="rounded-lg border border-border bg-background px-2 py-1 text-xs"><option>Pending</option><option>Processing</option><option>Ready for Pickup</option><option>Out for Delivery</option><option>Delivered</option><option>Received</option><option>Cancelled</option></select></td><td className="px-5 py-4">{order.receivedAt ? <span className="text-xs font-bold text-emerald-600"><Check className="mr-1 inline h-4 w-4" />{orderDateTime(order.receivedAt)}</span> : <span className="text-xs text-muted-foreground">Not confirmed</span>}</td></tr>)}</tbody></table>{!orders.length && <EmptyState text="No pharmacy orders yet." />}</div></div></div>;
}

function Claims({ patients, onPatients }: { patients: AdminPatient[]; onPatients: (value: AdminPatient[]) => void }) {
  const claims = patients.flatMap(patient => patient.clinical.claims.map(claim => ({ ...claim, patient })));
  const statuses = ['Draft', 'Processing', 'Approved', 'Partially Approved', 'Denied'] as const;
  const update = (claimId: string, patientId: string, status: typeof statuses[number]) => {
    const nextClaims = patients.find(patient => patient.id === patientId)?.clinical.claims
      .map(claim => claim.id === claimId ? { ...claim, status } : claim) ?? [];
    onPatients(patients.map(patient => patient.id === patientId
      ? { ...patient, clinical: { ...patient.clinical, claims: nextClaims } }
      : patient));
    void serverUpdatePatient(patientId, { claims: nextClaims as Record<string, unknown>[] }).catch(() => {
      addAuditEvent('Failed to persist insurance claim status', claimId);
    });
    addAuditEvent(`Marked insurance claim ${status.toLowerCase()}`, claimId);
  };
  return <div className="space-y-5"><PageHeading eyebrow="Coverage operations" title="Insurance & claims" description="Review mock eligibility, claim amounts, patient balances, and claim statuses." /><div className={`${cardClass} overflow-hidden`}><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-4">Claim</th><th className="px-5 py-4">Patient</th><th className="px-5 py-4">Related service</th><th className="px-5 py-4">Coverage</th><th className="px-5 py-4">Patient balance</th><th className="px-5 py-4">Status</th></tr></thead><tbody className="divide-y divide-border">{claims.map(({ patient, ...claim }) => <tr key={claim.id}><td className="px-5 py-4 font-bold">{claim.reference}<br /><span className="text-xs font-normal text-muted-foreground">{claim.provider}</span></td><td className="px-5 py-4 font-semibold">{patient.name}</td><td className="px-5 py-4 text-muted-foreground">{claim.relatedLabel}<br /><span className="text-xs">{claim.relatedType}</span></td><td className="px-5 py-4 font-bold text-emerald-600">{money(claim.estimatedCoverage)}</td><td className="px-5 py-4 font-bold">{money(claim.patientBalance)}</td><td className="px-5 py-4"><select value={claim.status} onChange={event => update(claim.id, patient.id, event.target.value as typeof statuses[number])} className="rounded-lg border border-border bg-background px-2 py-1 text-xs"><option>{statuses[0]}</option><option>{statuses[1]}</option><option>{statuses[2]}</option><option>{statuses[3]}</option><option>{statuses[4]}</option></select></td></tr>)}</tbody></table>{!claims.length && <EmptyState text="No insurance claims are available." />}</div></div></div>;
}

function AdminMessages() {
  const currentUser = getCurrentSessionUser();
  const [threads, setThreads] = useState<ServerMessageConversation[]>([]);
  const [activeId, setActiveId] = useState('');
  const [messages, setMessages] = useState<ServerMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const refreshThreads = async () => {
    try {
      const response = await serverMessageConversations();
      setThreads(response.conversations);
      setActiveId(current => current || response.conversations[0]?.id || '');
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load patient messages.');
    } finally {
      setLoading(false);
    }
  };
  const refreshMessages = async (conversationId: string) => {
    if (!conversationId) return;
    try {
      const response = await serverMessages(conversationId);
      setMessages(response.messages);
      await serverMarkMessagesRead(conversationId);
      setThreads(current => current.map(thread => thread.id === conversationId ? { ...thread, unreadCount: 0, lastMessage: response.messages.at(-1) ?? null } : thread));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load this conversation.');
    }
  };
  useEffect(() => {
    void refreshThreads();
    const timer = window.setInterval(() => void refreshThreads(), 5000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    void refreshMessages(activeId);
    const timer = window.setInterval(() => void refreshMessages(activeId), 5000);
    return () => window.clearInterval(timer);
  }, [activeId]);
  const activeThread = threads.find(thread => thread.id === activeId);
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || !activeId || sending) return;
    setSending(true);
    try {
      const response = await serverSendMessage(activeId, input.trim());
      setMessages(current => [...current, response.message]);
      setInput('');
      await refreshThreads();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send message.');
    } finally {
      setSending(false);
    }
  };
  return <div className="space-y-5">
    <PageHeading eyebrow="Care communication" title="Patient messages" description="Communicate with patients through conversations stored in the shared PostgreSQL database." />
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    <div className={`${cardClass} flex min-h-[620px] overflow-hidden`}>
      <aside className="w-80 shrink-0 border-r border-border bg-card">
        <div className="border-b border-border bg-muted/30 p-4"><p className="text-xs font-bold uppercase tracking-widest text-primary">Patient inbox</p><p className="mt-1 text-xs text-muted-foreground">Unread messages refresh automatically.</p></div>
        <div className="divide-y divide-border">
          {loading ? <div className="space-y-3 p-4">{[1, 2, 3].map(item => <div key={item} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div> : threads.map(thread => <button key={thread.id} onClick={() => setActiveId(thread.id)} className={`flex w-full gap-3 border-l-2 p-4 text-left hover:bg-muted/50 ${activeId === thread.id ? 'border-primary bg-primary/5' : 'border-transparent'}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{thread.patientInitials}</span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-bold">{thread.patientName}</span>{thread.unreadCount > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">{thread.unreadCount}</span>}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{thread.lastMessage?.body ?? 'No messages yet'}</span></span></button>)}</div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col bg-slate-50/50 dark:bg-background">
        {activeThread ? <>
          <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-5"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">{activeThread.patientInitials}</span><div><h2 className="text-sm font-bold">{activeThread.patientName}</h2><p className="text-xs text-muted-foreground">{activeThread.patientEmail}</p></div></header>
          <div className="flex-1 space-y-4 overflow-y-auto p-5">{messages.length ? messages.map(message => { const mine = message.senderId === currentUser?.id; return <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm ${mine ? 'rounded-tr-sm bg-primary text-primary-foreground' : 'rounded-tl-sm border border-border bg-card'}`}><p className="whitespace-pre-wrap">{message.body}</p><p className={`mt-2 text-[10px] ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{new Date(message.createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</p></div></div>; }) : <div className="flex h-full flex-col items-center justify-center text-muted-foreground"><MessageSquare className="mb-3 h-12 w-12 opacity-30" /><p>No messages in this conversation.</p></div>}</div>
          <form onSubmit={send} className="flex gap-2 border-t border-border bg-card p-4"><textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(event); } }} rows={1} placeholder="Reply to this patient..." className="min-h-[48px] flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary" /><button type="submit" disabled={!input.trim() || sending} className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"><Send className="h-5 w-5" /></button></form>
        </> : <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground"><MessageSquare className="mb-3 h-16 w-16 opacity-20" /><p>Select a patient conversation</p></div>}
      </section>
    </div>
  </div>;
}

function Reports({ patients, payments, medications, orders }: { patients: AdminPatient[]; payments: AdminPayment[]; medications: AdminMedication[]; orders: AdminOrder[] }) {
  const claims = patients.flatMap(p => p.clinical.claims); const appointmentCount = patients.reduce((sum, p) => sum + p.clinical.appointments.length, 0); const sales = orders.reduce((sum, o) => sum + (o.totals?.total ?? 0), 0);
  const rows = [['Appointments', appointmentCount, 'All scheduled and historical appointments'], ['Payments collected', money(payments.filter(p => p.status === 'Paid').reduce((s, p) => s + p.amount, 0)), 'Stripe Test Mode paid transactions'], ['Pharmacy sales', money(sales), 'Patient pharmacy orders'], ['Inventory value', money(medications.reduce((s, m) => s + m.price * m.stock, 0)), 'Current catalog price × stock'], ['Insurance claims', claims.length, 'Mock claims across patients']];
  return <div className="space-y-5"><PageHeading eyebrow="Insights" title="Reports" description="Operational summaries for appointments, payments, medication sales, inventory, and claims." /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map(([label, value, detail]) => <div key={String(label)} className={`${cardClass} p-5`}><p className="text-sm font-semibold text-muted-foreground">{label as string}</p><p className="mt-2 text-2xl font-bold text-primary">{value as string | number}</p><p className="mt-2 text-xs text-muted-foreground">{detail as string}</p></div>)}</div></div>;
}

function Audit({ events }: { events: Array<{ id: string; actor: string; action: string; target: string; timestamp: string }> }) {
  return <div className="space-y-5"><PageHeading eyebrow="Accountability" title="Audit log" description="Important administrator actions and patient record access are stored in the shared database." /><div className={`${cardClass} overflow-hidden`}><div className="divide-y divide-border">{events.length ? events.map(event => <div key={event.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{event.action}</p><p className="text-xs text-muted-foreground">Target: {event.target} · Actor: {event.actor}</p></div><time className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString('en-PH')}</time></div>) : <EmptyState text="No audit events yet. View a patient or update an admin record to create one." />}</div></div></div>;
}

function Field({ name, label, defaultValue, type = 'text', step, required }: { name: string; label: string; defaultValue?: string | number; type?: string; step?: string; required?: boolean }) {
  return <label className="block text-sm font-semibold">{label}<input name={name} type={type} step={step} defaultValue={defaultValue} required={required} className={`${inputClass} mt-1.5`} /></label>;
}
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }
function SimpleTable({ columns, rows }: { columns: string[]; rows: any[][] }) { return <div className={`${cardClass} overflow-hidden`}><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{columns.map(c => <th key={c} className="px-5 py-4">{c}</th>)}</tr></thead><tbody className="divide-y divide-border">{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="px-5 py-4 text-muted-foreground">{cell}</td>)}</tr>)}</tbody></table>{!rows.length && <EmptyState text="No records available." />}</div></div>; }
function ReadOnlyBlock({ title, items }: { title: string; items: string[] }) { return <div className={`${cardClass} p-5`}><div className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-primary" /><h2 className="font-bold">{title}</h2><span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Read-only</span></div><div className="mt-4 space-y-3">{items.map((item, i) => <pre key={i} className="whitespace-pre-wrap rounded-xl bg-muted/40 p-3 font-sans text-sm leading-relaxed text-muted-foreground">{item}</pre>)}{!items.length && <EmptyState text={`No ${title.toLowerCase()} available.`} />}</div></div>; }
function SoapSection({ title, text }: { title: string; text: string }) {
  return <div className="rounded-xl bg-muted/40 p-3"><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p><p className="whitespace-pre-line text-sm leading-relaxed">{text || 'Not documented.'}</p></div>;
}
function AdminImagingList({ records }: { records: ImagingRecord[] }) {
  const [selected, setSelected] = useState<ImagingRecord | null>(null);
  return <><div className={`${cardClass} p-5`}><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><ImageIcon className="h-5 w-5 text-primary" /><h2 className="text-lg font-bold">Imaging</h2></div><span className="text-xs text-muted-foreground">Read-only</span></div><div className="mt-4 grid gap-4 lg:grid-cols-2">{records.map(record => <div key={record.id} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{record.type} · {record.bodyArea}</p><p className="text-xs text-muted-foreground">{record.date} · {record.doctor}</p></div><StatusBadge value={record.status} /></div>{record.imageUrl && <button type="button" onClick={() => setSelected(record)} className="group relative mt-3 block w-full overflow-hidden rounded-lg bg-slate-900"><img src={record.imageUrl} alt={`${record.type} preview`} className="h-32 w-full object-cover transition group-hover:scale-[1.02]" /><span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-bold text-white"><Maximize2 className="h-3 w-3" /> Open preview</span></button>}<div className="mt-3 space-y-2 text-sm"><p><strong>Findings:</strong> {record.findings}</p><p><strong>Impression:</strong> {record.impression}</p></div><button type="button" onClick={() => downloadImagingReport(record)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold text-primary hover:bg-muted"><Download className="h-3.5 w-3.5" /> Download report</button></div>)}</div>{!records.length && <EmptyState text="No imaging records available." />}</div>{selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Admin imaging preview"><div className="relative max-h-[95vh] max-w-5xl overflow-auto rounded-2xl bg-card p-3 shadow-2xl"><button type="button" onClick={() => setSelected(null)} className="absolute right-5 top-5 z-10 rounded-full bg-black/70 p-2 text-white"><X className="h-5 w-5" /></button><img src={selected.imageUrl} alt={`${selected.type} enlarged preview`} className="max-h-[82vh] w-full rounded-xl object-contain" /><p className="px-2 pt-3 text-sm font-bold">{selected.type} · {selected.bodyArea} · {selected.date}</p></div></div>}</>;
}
function EmptyState({ text }: { text: string }) { return <div className="p-10 text-center text-sm text-muted-foreground"><FileText className="mx-auto mb-3 h-8 w-8 opacity-30" />{text}</div>; }

function toAdminPatients(remotePatients: ServerPatient[], localPatients: AdminPatient[]): AdminPatient[] {
  return remotePatients.map((remote) => {
    const local = localPatients.find((patient) => patient.email.toLowerCase() === remote.email.toLowerCase());
    const clinical = local?.clinical ?? {
      appointments: [],
      encounters: [],
      soapNotes: [],
      imaging: [],
      vitals: [],
      diagnoses: [],
      prescriptions: [],
      labResults: [],
      bills: [],
      payments: [],
      pharmacyOrders: [],
      insurance: null,
      claims: [],
    };
    const knownIds = new Set(remote.appointments.map(appointment => appointment.id));
    const sharedEncounters = remote.records ?? [];
    return {
      ...remote,
      id: remote.id,
      role: 'Patient',
      status: remote.status ?? 'Active',
      lastActive: remote.lastActive,
      clinical: {
        ...clinical,
        insurance: (remote.insurance as any) ?? clinical.insurance,
        claims: remote.claims ?? clinical.claims,
        appointments: remote.appointments,
        encounters: sharedEncounters,
        bills: sharedEncounters.flatMap((item: any) => (item.bills ?? []).map((bill: any) => ({
          ...bill,
          encounterId: bill.encounterId ?? item.id,
          encounterReference: bill.encounterReference ?? item.encounterReference,
        }))),
        payments: sharedEncounters.flatMap((item: any) => (item.payments ?? item.billing?.payments ?? []).map((payment: any) => ({
          ...payment,
          patientId: remote.id,
          encounterId: payment.encounterId ?? item.id,
          encounterReference: payment.encounterReference ?? item.encounterReference,
          patientName: remote.name,
        }))),
        soapNotes: sharedEncounters.flatMap((item: any) => item.soapNotes ?? []),
        imaging: sharedEncounters.flatMap((item: any) => item.imaging ?? []),
        vitals: sharedEncounters.flatMap((item: any) => item.vitals ?? []),
        diagnoses: sharedEncounters.flatMap((item: any) => item.diagnoses ?? []),
        prescriptions: sharedEncounters.flatMap((item: any) => item.prescriptions ?? []),
        labResults: sharedEncounters.flatMap((item: any) => item.laboratoryResults ?? []),
      },
    } as AdminPatient;
  });
}

function pharmacyPaymentRows(orders: AdminOrder[]): AdminPayment[] {
  return orders
    .filter(order => order.paymentStatus === 'paid' && order.paymentReference)
    .map(order => ({
      id: `pharmacy-payment-${order.reference}`,
      patientId: order.patientId,
      patientName: order.patientName ?? '—',
      amount: Number((order as any).paymentAmount ?? order.totals?.total ?? 0),
      status: 'Paid' as const,
      reference: order.paymentReference!,
      date: order.paymentDate ?? order.createdAt,
      description: `Pharmacy order ${order.reference}`,
      billId: order.billReference ?? (order as any).billId,
      orderReference: order.reference,
      fulfillmentStatus: order.fulfillmentStatus ?? order.status,
      fulfillmentMethod: order.fulfillmentDetails?.mode,
      receivedAt: order.receivedAt,
      stripeReference: order.paymentReference,
      stripeSessionId: order.stripeSessionId,
    }));
}

export default function Admin() {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const [section, setSection] = useState<Section>('overview');
  const [patients, setPatients] = useState<AdminPatient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [medications, setMedications] = useState<AdminMedication[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [schedules, setSchedules] = useState<AdminSchedule[]>([]);
  const [events, setEvents] = useState<Array<{ id: string; actor: string; action: string; target: string; timestamp: string }>>([]);
  const [selectedPatient, setSelectedPatient] = useState<AdminPatient | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([serverPharmacyCatalog(), serverPharmacyOrders(), serverAdminSchedules(), serverAuditEvents()])
      .then(([catalogResponse, ordersResponse, schedulesResponse, auditResponse]) => {
        if (!active) return;
        setMedications(catalogResponse.medications as AdminMedication[]);
        setOrders(ordersResponse.orders as AdminOrder[]);
        setSchedules(schedulesResponse.schedules as AdminSchedule[]);
        setEvents(auditResponse.events);
        setPayments(pharmacyPaymentRows(ordersResponse.orders as AdminOrder[]));
      })
      .catch(() => {
        if (!active) return;
        setMedications([]);
        setOrders([]);
        setSchedules([]);
        setEvents([]);
      });
    serverPatients()
      .then(async ({ patients: remotePatients }) => {
        if (!active) return;
        const enriched = await Promise.all(remotePatients.map(async remote => {
          if (remote.records?.length) return remote;
          const patientId = remote.id;
          if (!patientId) return remote;
          const isDemoPatient = remote.email.toLowerCase() === 'juan@example.com';
          if (!isDemoPatient) return remote;
          const legacy = createLegacyEncountersForPatient({ id: patientId, name: remote.name });
          if (!legacy.length) return remote;
          try {
            const migrated = await serverMigrateRecords(patientId, legacy);
            return { ...remote, records: migrated.encounters };
          } catch {
            return remote;
          }
        }));
        const merged = toAdminPatients(enriched, []);
        setPatients(merged);
        setPayments(current => [
          ...merged.flatMap(patient => patient.clinical.payments),
          ...current.filter(payment => payment.orderReference),
        ]);
      })
      .catch(() => {
        if (active) {
          setPatients([]);
          setPayments([]);
        }
      })
      .finally(() => {
        if (active) setPatientsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    const refreshPharmacy = () => {
      void serverPharmacyOrders().then(({ orders: remoteOrders }) => {
        if (!active) return;
        const normalizedOrders = remoteOrders as AdminOrder[];
        setOrders(normalizedOrders);
        setPayments(current => [
          ...current.filter(payment => !payment.orderReference),
          ...pharmacyPaymentRows(normalizedOrders),
        ]);
      }).catch(() => undefined);
    };
    window.addEventListener('focus', refreshPharmacy);
    const interval = window.setInterval(refreshPharmacy, 10000);
    return () => {
      active = false;
      window.removeEventListener('focus', refreshPharmacy);
      window.clearInterval(interval);
    };
  }, []);
  const appointments = useMemo(() => patients.flatMap(p => p.clinical.appointments), [patients]);
  const updatePatients = (value: AdminPatient[]) => { setPatients(value); };
  const updateMedications = (value: AdminMedication[]) => { setMedications(value); };
  const updateOrders = (value: AdminOrder[]) => { setOrders(value); };
  const updatePayments = (value: AdminPayment[]) => { setPayments(value); };
  const updateSchedules = (value: AdminSchedule[]) => {
    setSchedules(value);
    void serverSaveAdminSchedules(value).then(({ schedules: saved }) => setSchedules(saved as AdminSchedule[])).catch(() => undefined);
  };
  const handleLogout = () => { logout(); setLocation('/login'); };
  const content = selectedPatient ? <AdminPatientRecords patient={selectedPatient} payments={payments} orders={orders} onBack={() => setSelectedPatient(null)} /> :
    section === 'overview' ? <Overview patients={patients} appointments={appointments} payments={payments} medications={medications} orders={orders} /> :
    section === 'patients' ? <Patients patients={patients} loading={patientsLoading} onSelect={setSelectedPatient} /> :
    section === 'appointments' ? <Appointments patients={patients} schedules={schedules} onSchedules={updateSchedules} onPatients={updatePatients} /> :
    section === 'messages' ? <AdminMessages /> :
    section === 'payments' ? <Payments payments={payments} /> :
    section === 'medications' ? <Medications medications={medications} onMedications={updateMedications} /> :
    section === 'orders' ? <Orders orders={orders} patients={patients} onOrders={updateOrders} /> :
    section === 'claims' ? <Claims patients={patients} onPatients={updatePatients} /> :
    section === 'reports' ? <Reports patients={patients} payments={payments} medications={medications} orders={orders} /> :
    <Audit events={events} />;
  return <AdminShell section={selectedPatient ? 'patients' : section} onSection={value => { setSelectedPatient(null); setSection(value); }} onLogout={handleLogout}>{content}</AdminShell>;
}