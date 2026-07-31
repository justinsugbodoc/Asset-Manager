import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertCircle, ArrowLeft, CalendarDays, Check, ChevronRight, ClipboardList,
  CreditCard, FileCheck2, FileText, Filter, LayoutDashboard, LogOut, Menu, Package,
  Pencil, Plus, Search, Settings2, ShieldCheck, Stethoscope, Trash2, Truck, Users, X,
  Download, Image as ImageIcon, Maximize2,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { getCurrentSessionUser, useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import {
  addAuditEvent, loadAdminMedications, loadAdminOrders, loadAdminPatients, loadAdminPayments,
  loadAdminSchedules, loadAuditEvents, saveAdminMedications, saveAdminOrders, saveAdminPatients,
  saveAdminSchedules, saveAdminPayments, seedAdminData,
  type AdminMedication, type AdminOrder, type AdminPatient, type AdminPayment, type AdminSchedule,
} from '@/lib/admin';
import { downloadImagingReport, type ImagingRecord, type SoapNote, getImagingRecords } from '@/lib/clinical';
import { addEncounterRecord, completeAppointment, getPatientEncounters, isClinicalUser, syncAppointmentStatus, type Encounter, updateEncounter } from '@/lib/encounters';

type Section = 'overview' | 'patients' | 'appointments' | 'payments' | 'medications' | 'orders' | 'imaging' | 'claims' | 'reports' | 'audit';
type PatientTab = 'overview' | 'appointments' | 'clinical' | 'prescriptions' | 'labs' | 'billing' | 'pharmacy' | 'insurance';

const sectionItems: Array<{ id: Section; label: string; icon: any }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'patients', label: 'Patients', icon: Users },
  { id: 'appointments', label: 'Appointments', icon: CalendarDays },
  { id: 'payments', label: 'Payments & Billing', icon: CreditCard },
  { id: 'medications', label: 'Pharmacy Inventory', icon: Package },
  { id: 'orders', label: 'Pharmacy Orders', icon: Truck },
  { id: 'imaging', label: 'Imaging Records', icon: ImageIcon },
  { id: 'claims', label: 'Insurance & Claims', icon: ShieldCheck },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'audit', label: 'Audit Log', icon: ClipboardList },
];

const cardClass = 'rounded-2xl border border-border bg-card shadow-sm';
const inputClass = 'h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';
const money = (amount: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
const badge = (status: string) => {
  if (['Active', 'Paid', 'Approved', 'Received', 'Available', 'Delivered'].includes(status)) return 'bg-emerald-100 text-emerald-800';
  if (['Inactive', 'Denied', 'Cancelled', 'Out of Stock', 'Failed', 'Disabled'].includes(status)) return 'bg-rose-100 text-rose-800';
  return 'bg-amber-100 text-amber-800';
};

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
          <p className="mt-1 text-xs text-muted-foreground">Prototype data · localStorage</p>
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

function PatientProfile({ patient, payments, onBack, onUpdate }: { patient: AdminPatient; payments: AdminPayment[]; onBack: () => void; onUpdate: (patient: AdminPatient) => void }) {
  const [tab, setTab] = useState<PatientTab>('overview');
  const sessionUser = getCurrentSessionUser();
  const canEditClinical = isClinicalUser(sessionUser);
  const [patientEncounters, setPatientEncounters] = useState(() => getPatientEncounters(patient.id, patient.name));
  const [selectedEncounterId, setSelectedEncounterId] = useState(patientEncounters[0]?.id ?? '');
  const selectedEncounter = patientEncounters.find(item => item.id === selectedEncounterId) ?? patientEncounters[0];
  const encounterBills = selectedEncounter
    ? patient.clinical.bills.filter((bill: any) => selectedEncounter.billing.relatedBillIds.includes(bill.id))
    : patient.clinical.bills;
  const encounterPayments = selectedEncounter
    ? selectedEncounter.billing.payments
    : payments.filter(payment => payment.patientId === patient.id);
  const tabs: Array<[PatientTab, string]> = [['overview', 'Overview'], ['appointments', 'Appointments'], ['clinical', 'Clinical records'], ['prescriptions', 'Prescriptions'], ['labs', 'Lab results'], ['billing', 'Bills & payments'], ['pharmacy', 'Pharmacy Orders'], ['insurance', 'Insurance & claims']];
  const editSoapNote = (note: any) => {
    if (!canEditClinical) return;
    const subjective = window.prompt('Subjective', note.subjective);
    if (subjective === null) return;
    const objective = window.prompt('Objective', note.objective);
    if (objective === null) return;
    const assessment = window.prompt('Assessment', note.assessment);
    if (assessment === null) return;
    const plan = window.prompt('Plan', note.plan);
    if (plan === null) return;
    onUpdate({
      ...patient,
      clinical: {
        ...patient.clinical,
        soapNotes: patient.clinical.soapNotes.map((item: any) => item.id === note.id ? { ...item, subjective, objective, assessment, plan, status: 'Amended' } : item),
      },
    });
    if (note.encounterId) {
      const updated = updateEncounter(note.encounterId, encounter => ({
        ...encounter,
        soapNotes: encounter.soapNotes.map(item => item.id === note.id ? { ...item, subjective, objective, assessment, plan, status: 'Amended' } : item),
      }));
      if (updated) setPatientEncounters(current => current.map(item => item.id === updated.id ? updated : item));
    }
    addAuditEvent('Amended SOAP note', note.consultationReference ?? note.id);
  };
  const updateAccount = (status: 'Active' | 'Inactive') => { onUpdate({ ...patient, status }); addAuditEvent(`${status === 'Active' ? 'Activated' : 'Deactivated'} patient account`, patient.name); };
  return <div className="space-y-5">
    <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> Back to patients</button>
    <div className={`${cardClass} overflow-hidden`}><div className="bg-gradient-to-br from-primary/10 via-card to-card p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground">{patient.initials}</div><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{patient.name}</h1><StatusBadge value={patient.status} /></div><p className="mt-1 text-sm text-muted-foreground">{patient.email} · {patient.phone}</p><p className="mt-1 text-xs text-muted-foreground">Patient ID: {patient.id} · Last active {new Date(patient.lastActive).toLocaleDateString('en-PH')}</p></div></div><div className="flex gap-2"><button onClick={() => updateAccount(patient.status === 'Active' ? 'Inactive' : 'Active')} className={`rounded-xl px-3 py-2 text-xs font-bold ${patient.status === 'Active' ? 'border border-rose-200 text-rose-700 hover:bg-rose-50' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>{patient.status === 'Active' ? 'Deactivate' : 'Activate'}</button><button onClick={() => { const name = window.prompt('Update patient display name', patient.name); if (name?.trim()) { onUpdate({ ...patient, name: name.trim() }); addAuditEvent('Updated patient account', patient.name); } }} className="rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-muted"><Pencil className="mr-1 inline h-3 w-3" /> Update</button></div></div></div><div className="flex gap-1 overflow-x-auto border-t border-border p-2">{tabs.map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold ${tab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{label}</button>)}</div></div>
    {tab === 'overview' && <div className="grid gap-5 lg:grid-cols-3"><div className={`${cardClass} p-5 lg:col-span-2`}><h2 className="font-bold">Personal information</h2><div className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><Info label="Email" value={patient.email} /><Info label="Phone" value={patient.phone || '—'} /><Info label="Birthday" value={patient.birthday || '—'} /><Info label="Gender" value={patient.gender || '—'} /><Info label="Blood type" value={patient.bloodType || '—'} /><Info label="Account status" value={patient.status} /></div></div><div className={`${cardClass} p-5`}><h2 className="font-bold">Patient summary</h2><div className="mt-4 space-y-3 text-sm"><SummaryLine label="Appointments" value={patient.clinical.appointments.length} /><SummaryLine label="Diagnoses" value={patient.clinical.diagnoses.length} /><SummaryLine label="Prescriptions" value={patient.clinical.prescriptions.length} /><SummaryLine label="Bills" value={patient.clinical.bills.length} /><SummaryLine label="Claims" value={patient.clinical.claims.length} /></div></div></div>}
    {tab === 'appointments' && <SimpleTable columns={['Date', 'Doctor', 'Clinic', 'Status', 'Encounter']} rows={patient.clinical.appointments.map(a => { const encounter = patientEncounters.find(item => item.appointmentId === a.id); return [a.date, a.doctor?.name ?? a.doctor, a.doctor?.clinic ?? '—', a.status, encounter?.encounterReference ?? '—']; })} />}
    {tab === 'clinical' && <AdminEncounterClinicalPanel encounters={patientEncounters} selectedEncounterId={selectedEncounterId} onSelect={setSelectedEncounterId} canEditClinical={canEditClinical} editSoapNote={editSoapNote} />}
    {tab === 'prescriptions' && <SimpleTable columns={['Medicine', 'Dosage', 'Instructions', 'Status', 'Encounter']} rows={(selectedEncounter?.prescriptions ?? []).map((rx: any) => [rx.name, rx.dosage, rx.instructions, rx.status, selectedEncounter.encounterReference])} />}
    {tab === 'labs' && <div className="space-y-5"><div><h2 className="mb-3 text-lg font-bold">Lab results</h2><SimpleTable columns={['Test', 'Result', 'Range', 'Date', 'Status']} rows={(selectedEncounter?.laboratoryResults ?? []).map((lab: any) => [lab.test, lab.result, lab.range, lab.date, lab.status])} /></div><AdminImagingList records={selectedEncounter?.imaging ?? []} /></div>}
    {tab === 'billing' && <div className="space-y-5"><div><h2 className="mb-3 text-lg font-bold">Bills · {selectedEncounter?.encounterReference ?? 'All encounters'}</h2><SimpleTable columns={['Description', 'Date', 'Amount', 'Status', 'Encounter']} rows={encounterBills.map((bill: any) => [bill.description, bill.date, money(bill.amount), bill.status, bill.encounterReference ?? selectedEncounter?.encounterReference ?? '—'])} /></div><div><h2 className="mb-3 text-lg font-bold">Payments</h2><SimpleTable columns={['Description', 'Date', 'Amount', 'Reference', 'Status', 'Encounter']} rows={encounterPayments.map((payment: any) => [payment.description, payment.date, money(payment.amount), payment.reference, payment.status, payment.encounterReference ?? selectedEncounter?.encounterReference ?? '—'])} /></div></div>}
    {tab === 'pharmacy' && <SimpleTable columns={['Order', 'Created', 'Fulfillment', 'Payment', 'Received', 'Encounter']} rows={(selectedEncounter?.pharmacyOrders ?? []).map((order: any) => [order.reference, new Date(order.createdAt).toLocaleDateString(), order.fulfillmentDetails?.mode ?? '—', order.paymentStatus ?? '—', order.status === 'Received' ? 'Yes' : 'No', order.encounterReference ?? selectedEncounter?.encounterReference ?? '—'])} />}
    {tab === 'insurance' && <div className="grid gap-5 lg:grid-cols-2"><div className={`${cardClass} p-5`}><h2 className="font-bold">Insurance details</h2>{patient.clinical.insurance ? <div className="mt-4 grid gap-4 sm:grid-cols-2"><Info label="Provider" value={patient.clinical.insurance.provider} /><Info label="Member number" value={patient.clinical.insurance.memberNumber} /><Info label="Plan" value={patient.clinical.insurance.plan} /><Info label="Expiration" value={patient.clinical.insurance.expirationDate} /></div> : <EmptyState text="No insurance record saved." />}</div><div className={`${cardClass} p-5`}><h2 className="font-bold">Claims</h2>{patient.clinical.claims.length ? <div className="mt-4 space-y-3">{patient.clinical.claims.map(claim => <div key={claim.id} className="flex items-center justify-between rounded-xl bg-muted/40 p-3 text-sm"><div><p className="font-semibold">{claim.reference}</p><p className="text-xs text-muted-foreground">{claim.relatedLabel}</p></div><StatusBadge value={claim.status} /></div>)}</div> : <EmptyState text="No claims submitted." />}</div></div>}
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"><strong>Clinical record protection:</strong> SOAP notes, diagnoses, prescriptions, laboratory results, and other clinical records are read-only in the admin portal. Editing requires explicit clinical authorization.</div>
  </div>;
}

function Patients({ patients, onSelect, onUpdate }: { patients: AdminPatient[]; onSelect: (patient: AdminPatient) => void; onUpdate: (patient: AdminPatient) => void }) {
  const [query, setQuery] = useState(''); const [status, setStatus] = useState('All'); const [page, setPage] = useState(1);
  const filtered = patients.filter(p => `${p.name} ${p.email} ${p.id}`.toLowerCase().includes(query.toLowerCase()) && (status === 'All' || p.status === status));
  const pageSize = 6; const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize)); const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const changeQuery = (value: string) => { setQuery(value); setPage(1); }; const changeStatus = (value: string) => { setStatus(value); setPage(1); };
  return <div className="space-y-5"><PageHeading eyebrow="Patient management" title="Patient accounts" description="Search patients, review their complete profile, and manage account access." /><div className={`${cardClass} p-4`}><div className="grid gap-3 md:grid-cols-[1fr_180px]"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input value={query} onChange={e => changeQuery(e.target.value)} placeholder="Search by name, email, or patient ID" className={`${inputClass} pl-9`} /></div><select value={status} onChange={e => changeStatus(e.target.value)} className={inputClass}><option>All</option><option>Active</option><option>Inactive</option></select></div></div><div className={`${cardClass} overflow-hidden`}><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-4">Patient</th><th className="px-5 py-4">Contact</th><th className="px-5 py-4">Last active</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Action</th></tr></thead><tbody className="divide-y divide-border">{visible.map(patient => <tr key={patient.id} className="hover:bg-muted/30"><td className="px-5 py-4"><button onClick={() => { onSelect(patient); addAuditEvent('Viewed patient profile', patient.name); }} className="flex items-center gap-3 text-left hover:text-primary"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{patient.initials}</span><span><span className="block font-bold">{patient.name}</span><span className="block text-xs text-muted-foreground">{patient.id}</span></span></button></td><td className="px-5 py-4 text-muted-foreground">{patient.email}<br />{patient.phone}</td><td className="px-5 py-4 text-muted-foreground">{new Date(patient.lastActive).toLocaleDateString('en-PH')}</td><td className="px-5 py-4"><StatusBadge value={patient.status} /></td><td className="px-5 py-4"><button onClick={() => onSelect(patient)} className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">Open profile <ChevronRight className="h-3 w-3" /></button></td></tr>)}</tbody></table>{!filtered.length && <EmptyState text="No patients match your filters." />}</div><div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground"><span>Showing {visible.length} of {filtered.length} patients</span><div className="flex items-center gap-2"><button disabled={page === 1} onClick={() => setPage(current => current - 1)} className="rounded-lg border border-border px-3 py-1.5 font-bold disabled:opacity-40">Previous</button><span>Page {page} of {pageCount}</span><button disabled={page === pageCount} onClick={() => setPage(current => current + 1)} className="rounded-lg border border-border px-3 py-1.5 font-bold disabled:opacity-40">Next</button></div></div></div></div>;
}

function Appointments({ patients, schedules, onSchedules, onPatients }: { patients: AdminPatient[]; schedules: AdminSchedule[]; onSchedules: (value: AdminSchedule[]) => void; onPatients: (value: AdminPatient[]) => void }) {
  const [filter, setFilter] = useState('All');
  const entries = patients.flatMap(patient => patient.clinical.appointments.map(appointment => ({ ...appointment, patient })));
  const filtered = entries.filter(item => filter === 'All' || item.status === filter);
  const update = (entry: any, status: string) => {
    if (status === 'Completed' && entry.status !== 'Confirmed') return;
    const encounter = status === 'Completed' ? completeAppointment(entry, entry.patient) : null;
    onPatients(patients.map(patient => patient.id === entry.patient.id
      ? { ...patient, clinical: { ...patient.clinical, appointments: patient.clinical.appointments.map((appointment: any) => appointment.id === entry.id ? { ...appointment, status } : appointment), encounters: encounter ? [...patient.clinical.encounters.filter((item: any) => item.appointmentId !== entry.id), encounter] : patient.clinical.encounters } }
      : patient));
    syncAppointmentStatus({ ...entry, status });
    addAuditEvent(`Marked appointment ${status.toLowerCase()}`, `${entry.patient.name} · ${entry.doctor?.name ?? 'Provider'}`);
    if (encounter) addAuditEvent('Linked completed appointment to encounter', encounter.encounterReference);
  };
  return <div className="space-y-5"><PageHeading eyebrow="Care operations" title="Appointments & schedules" description="Manage provider availability and appointment status across the patient portal." action={<select value={filter} onChange={e => setFilter(e.target.value)} className={inputClass + ' w-auto'}><option>All</option><option>Confirmed</option><option>Pending</option><option>Completed</option><option>Cancelled</option><option>Rescheduled</option></select>} /><div className={`${cardClass} p-5`}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold">Doctor schedules</h2><p className="text-xs text-muted-foreground">Availability used by booking operations</p></div><button onClick={() => onSchedules([...schedules, { id: `schedule_${Date.now()}`, doctorId: 'dr_custom', doctorName: 'New Doctor', specialty: 'Internal Medicine', clinic: 'SugboDoc Main Clinic', day: 'Monday', startTime: '09:00', endTime: '17:00', slots: 8, enabled: true }])} className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"><Plus className="mr-1 inline h-3 w-3" /> Add schedule</button></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{schedules.map(schedule => <div key={schedule.id} className="rounded-xl border border-border p-4"><div className="flex justify-between"><p className="font-semibold">{schedule.doctorName}</p><StatusBadge value={schedule.enabled ? 'Active' : 'Disabled'} /></div><p className="mt-1 text-xs text-muted-foreground">{schedule.specialty} · {schedule.clinic}</p><p className="mt-3 text-sm">{schedule.day} · {schedule.startTime}–{schedule.endTime} · {schedule.slots} slots</p><div className="mt-3 flex flex-wrap gap-3"><button onClick={() => { const doctorName = window.prompt('Doctor name', schedule.doctorName) ?? schedule.doctorName; const specialty = window.prompt('Specialty', schedule.specialty) ?? schedule.specialty; const clinic = window.prompt('Clinic', schedule.clinic) ?? schedule.clinic; const day = window.prompt('Day of week', schedule.day) ?? schedule.day; const startTime = window.prompt('Start time (HH:MM)', schedule.startTime) ?? schedule.startTime; const endTime = window.prompt('End time (HH:MM)', schedule.endTime) ?? schedule.endTime; const slots = Number(window.prompt('Available time slots', String(schedule.slots)) ?? schedule.slots); onSchedules(schedules.map(s => s.id === schedule.id ? { ...s, doctorName, specialty, clinic, day, startTime, endTime, slots: Number.isFinite(slots) ? slots : schedule.slots } : s)); addAuditEvent('Updated doctor schedule', doctorName); }} className="text-xs font-bold text-primary hover:underline">Edit provider & slots</button><button onClick={() => onSchedules(schedules.map(s => s.id === schedule.id ? { ...s, enabled: !s.enabled } : s))} className="text-xs font-bold text-primary hover:underline">{schedule.enabled ? 'Disable' : 'Enable'} schedule</button></div></div>)}</div></div><div className={`${cardClass} overflow-hidden`}><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-4">Patient</th><th className="px-5 py-4">Provider</th><th className="px-5 py-4">Date & time</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Actions</th></tr></thead><tbody className="divide-y divide-border">{filtered.map(entry => <tr key={`${entry.patient.id}-${entry.id}`}><td className="px-5 py-4 font-semibold">{entry.patient.name}</td><td className="px-5 py-4">{entry.doctor?.name}</td><td className="px-5 py-4 text-muted-foreground">{entry.date}<br />{entry.time}</td><td className="px-5 py-4"><StatusBadge value={entry.status} />{entry.status === 'Completed' && <p className="mt-1 text-[10px] text-emerald-700">Encounter linked</p>}</td><td className="px-5 py-4"><div className="flex flex-wrap gap-2">{entry.status === 'Confirmed' && <button key="Completed" onClick={() => update(entry, 'Completed')} className="rounded-lg bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground hover:bg-primary/90">Mark Completed</button>}{['Confirmed', 'Rescheduled', 'Cancelled'].map(action => <button key={action} onClick={() => update(entry, action)} className="rounded-lg border border-border px-2 py-1 text-[10px] font-bold hover:bg-muted">{action}</button>)}</div></td></tr>)}</tbody></table></div></div></div>;
}

function Payments({ payments, onPayments }: { payments: AdminPayment[]; onPayments: (value: AdminPayment[]) => void }) {
  const [query, setQuery] = useState(''); const [status, setStatus] = useState('All');
  const filtered = payments.filter(p => `${p.patientName} ${p.reference} ${p.description}`.toLowerCase().includes(query.toLowerCase()) && (status === 'All' || p.status === status));
  return <div className="space-y-5"><PageHeading eyebrow="Stripe Test Mode" title="Payments & billing" description="Monitor test transactions, payment status, amounts, and related patients." /><div className="grid gap-3 md:grid-cols-[1fr_180px]"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search patient, reference, or description" className={`${inputClass} pl-9`} /></div><select value={status} onChange={e => setStatus(e.target.value)} className={inputClass}><option>All</option><option>Paid</option><option>Pending</option><option>Failed</option><option>Refunded</option></select></div><div className={`${cardClass} overflow-hidden`}><div className="flex items-center gap-2 border-b border-border bg-amber-50 p-4 text-xs text-amber-900"><AlertCircle className="h-4 w-4" /> Test Mode monitoring · no live charges are made from this prototype.</div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-4">Patient</th><th className="px-5 py-4">Description</th><th className="px-5 py-4">Amount</th><th className="px-5 py-4">Reference</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Action</th></tr></thead><tbody className="divide-y divide-border">{filtered.map(payment => <tr key={payment.id}><td className="px-5 py-4 font-semibold">{payment.patientName}</td><td className="px-5 py-4 text-muted-foreground">{payment.description}<br /><span className="text-xs">{payment.date}</span></td><td className="px-5 py-4 font-bold">{money(payment.amount)}</td><td className="px-5 py-4 font-mono text-xs">{payment.reference}</td><td className="px-5 py-4"><StatusBadge value={payment.status} /></td><td className="px-5 py-4"><select value={payment.status} onChange={e => onPayments(payments.map(p => p.id === payment.id ? { ...p, status: e.target.value as AdminPayment['status'] } : p))} className="rounded-lg border border-border bg-background px-2 py-1 text-xs"><option>Paid</option><option>Pending</option><option>Failed</option><option>Refunded</option></select></td></tr>)}</tbody></table>{!filtered.length && <EmptyState text="No payments match your filters." />}</div></div></div>;
}

function Medications({ medications, onMedications }: { medications: AdminMedication[]; onMedications: (value: AdminMedication[]) => void }) {
  const [query, setQuery] = useState(''); const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<AdminMedication | null>(null);
  const filtered = medications.filter(m => `${m.name} ${m.genericName} ${m.category}`.toLowerCase().includes(query.toLowerCase()));
  const save = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); const next: AdminMedication = { id: editing?.id ?? `med_${Date.now()}`, name: String(data.get('name')), description: String(data.get('description')), genericName: String(data.get('genericName')), dosage: String(data.get('dosage')), dosageForm: String(data.get('dosageForm')), form: String(data.get('dosageForm')), category: String(data.get('category')), price: Number(data.get('price')), stock: Number(data.get('stock')), enabled: Number(data.get('stock')) > 0, availability: Number(data.get('stock')) > 50 ? 'Available' : Number(data.get('stock')) > 0 ? 'Low Stock' : 'Out of Stock', partnerLocations: editing?.partnerLocations ?? ['Sugbo Pharmacy Escario'], updatedAt: new Date().toISOString() }; onMedications(editing ? medications.map(m => m.id === editing.id ? next : m) : [next, ...medications]); addAuditEvent(editing ? 'Updated medication inventory' : 'Added medication', next.name); setEditing(null); setShowForm(false); };
  return <div className="space-y-5"><PageHeading eyebrow="Pharmacy operations" title="Medication inventory" description="Add, edit, restock, disable, or remove medicines shown in the patient Medication page." action={<button onClick={() => { setEditing(null); setShowForm(true); }} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><Plus className="mr-1 inline h-4 w-4" /> Add medication</button>} />{showForm && <form onSubmit={save} className={`${cardClass} grid gap-4 p-5 md:grid-cols-2`}><h2 className="md:col-span-2 font-bold">{editing ? 'Edit medication' : 'Add new medication'}</h2><Field name="name" label="Medication name" defaultValue={editing?.name} required /><Field name="genericName" label="Generic name" defaultValue={editing?.genericName} required /><Field name="description" label="Description" defaultValue={editing?.description} required /><Field name="dosage" label="Dosage" defaultValue={editing?.dosage} required /><Field name="dosageForm" label="Dosage form" defaultValue={editing?.dosageForm} required /><Field name="category" label="Category" defaultValue={editing?.category} required /><Field name="price" label="Price (PHP)" type="number" step="0.01" defaultValue={editing?.price} required /><Field name="stock" label="Stock quantity" type="number" defaultValue={editing?.stock} required /><div className="flex gap-2 md:col-span-2"><button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><Check className="mr-1 inline h-4 w-4" /> Save</button><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold">Cancel</button></div></form>}<div className={`${cardClass} overflow-hidden`}><div className="border-b border-border p-4"><div className="relative max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search inventory" className={`${inputClass} pl-9`} /></div></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-4">Medication</th><th className="px-5 py-4">Category / form</th><th className="px-5 py-4">Price</th><th className="px-5 py-4">Stock</th><th className="px-5 py-4">Availability</th><th className="px-5 py-4">Actions</th></tr></thead><tbody className="divide-y divide-border">{filtered.map(med => <tr key={med.id}><td className="px-5 py-4"><p className="font-bold">{med.name}</p><p className="text-xs text-muted-foreground">{med.genericName}</p></td><td className="px-5 py-4 text-muted-foreground">{med.category}<br />{med.dosage} · {med.form}</td><td className="px-5 py-4 font-bold">{money(med.price)}</td><td className="px-5 py-4"><input type="number" min="0" value={med.stock} onChange={e => { const stock = Number(e.target.value); onMedications(medications.map(m => m.id === med.id ? { ...m, stock, enabled: stock > 0 && m.enabled, availability: !m.enabled ? 'Disabled' : stock > 50 ? 'Available' : stock > 0 ? 'Low Stock' : 'Out of Stock' } : m)); }} className="h-8 w-20 rounded-lg border border-border bg-background px-2 text-xs" /></td><td className="px-5 py-4"><StatusBadge value={med.enabled ? med.availability : 'Disabled'} /></td><td className="px-5 py-4"><div className="flex flex-wrap gap-1.5"><button onClick={() => { setEditing(med); setShowForm(true); }} className="rounded-lg border border-border p-2 hover:bg-muted" title="Edit"><Pencil className="h-3.5 w-3.5" /></button><button onClick={() => onMedications(medications.map(m => m.id === med.id ? { ...m, enabled: !m.enabled, availability: !m.enabled ? (m.stock > 50 ? 'Available' : m.stock > 0 ? 'Low Stock' : 'Out of Stock') : 'Disabled' } : m))} className="rounded-lg border border-border px-2 py-1.5 text-[10px] font-bold">{med.enabled ? 'Disable' : 'Enable'}</button><button onClick={() => { if (window.confirm(`Remove ${med.name}?`)) { onMedications(medications.filter(m => m.id !== med.id)); addAuditEvent('Removed medication', med.name); } }} className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50" title="Remove"><Trash2 className="h-3.5 w-3.5" /></button></div></td></tr>)}</tbody></table>{!filtered.length && <EmptyState text="No medications match your search." />}</div></div></div>;
}

function Orders({ orders, patients, onOrders }: { orders: AdminOrder[]; patients: AdminPatient[]; onOrders: (value: AdminOrder[]) => void }) {
  const update = (order: AdminOrder, status: AdminOrder['status']) => { onOrders(orders.map(item => item.reference === order.reference ? { ...item, status } : item)); addAuditEvent('Updated pharmacy order status', order.reference); };
  return <div className="space-y-5"><PageHeading eyebrow="Pharmacy fulfillment" title="Pharmacy Orders" description="Update delivery or pickup progress and see whether patients confirmed receipt." /><div className={`${cardClass} overflow-hidden`}><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-4">Order</th><th className="px-5 py-4">Patient</th><th className="px-5 py-4">Fulfillment</th><th className="px-5 py-4">Amount</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Patient received?</th></tr></thead><tbody className="divide-y divide-border">{orders.map(order => <tr key={order.reference}><td className="px-5 py-4 font-mono text-xs font-bold">{order.reference}</td><td className="px-5 py-4 font-semibold">{order.patientName || patients.find(p => p.id === order.patientId)?.name || '—'}</td><td className="px-5 py-4 text-muted-foreground">{order.fulfillmentDetails?.mode === 'delivery' ? 'Delivery' : 'Pickup'}<br /><span className="text-xs">{order.fulfillmentDetails?.location || order.fulfillmentDetails?.address || '—'}</span></td><td className="px-5 py-4 font-bold">{money(order.totals?.total ?? 0)}</td><td className="px-5 py-4"><select value={order.status} onChange={e => update(order, e.target.value as AdminOrder['status'])} className="rounded-lg border border-border bg-background px-2 py-1 text-xs"><option>Pending</option><option>Processing</option><option>Ready for Pickup</option><option>Out for Delivery</option><option>Delivered</option><option>Received</option><option>Cancelled</option></select></td><td className="px-5 py-4">{order.status === 'Received' ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600"><Check className="h-4 w-4" /> Yes</span> : <span className="text-xs text-muted-foreground">No</span>}</td></tr>)}</tbody></table>{!orders.length && <EmptyState text="No pharmacy orders yet." />}</div></div></div>;
}

function Claims({ patients, onPatients }: { patients: AdminPatient[]; onPatients: (value: AdminPatient[]) => void }) {
  const claims = patients.flatMap(patient => patient.clinical.claims.map(claim => ({ ...claim, patient })));
  const statuses = ['Draft', 'Processing', 'Approved', 'Partially Approved', 'Denied'] as const;
  const update = (claimId: string, patientId: string, status: typeof statuses[number]) => {
    onPatients(patients.map(patient => patient.id === patientId ? { ...patient, clinical: { ...patient.clinical, claims: patient.clinical.claims.map(claim => claim.id === claimId ? { ...claim, status } : claim) } } : patient));
    addAuditEvent(`Marked insurance claim ${status.toLowerCase()}`, claimId);
  };
  return <div className="space-y-5"><PageHeading eyebrow="Coverage operations" title="Insurance & claims" description="Review mock eligibility, claim amounts, patient balances, and claim statuses." /><div className={`${cardClass} overflow-hidden`}><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-4">Claim</th><th className="px-5 py-4">Patient</th><th className="px-5 py-4">Related service</th><th className="px-5 py-4">Coverage</th><th className="px-5 py-4">Patient balance</th><th className="px-5 py-4">Status</th></tr></thead><tbody className="divide-y divide-border">{claims.map(({ patient, ...claim }) => <tr key={claim.id}><td className="px-5 py-4 font-bold">{claim.reference}<br /><span className="text-xs font-normal text-muted-foreground">{claim.provider}</span></td><td className="px-5 py-4 font-semibold">{patient.name}</td><td className="px-5 py-4 text-muted-foreground">{claim.relatedLabel}<br /><span className="text-xs">{claim.relatedType}</span></td><td className="px-5 py-4 font-bold text-emerald-600">{money(claim.estimatedCoverage)}</td><td className="px-5 py-4 font-bold">{money(claim.patientBalance)}</td><td className="px-5 py-4"><select value={claim.status} onChange={event => update(claim.id, patient.id, event.target.value as typeof statuses[number])} className="rounded-lg border border-border bg-background px-2 py-1 text-xs"><option>{statuses[0]}</option><option>{statuses[1]}</option><option>{statuses[2]}</option><option>{statuses[3]}</option><option>{statuses[4]}</option></select></td></tr>)}</tbody></table>{!claims.length && <EmptyState text="No insurance claims are available." />}</div></div></div>;
}

function Reports({ patients, payments, medications, orders }: { patients: AdminPatient[]; payments: AdminPayment[]; medications: AdminMedication[]; orders: AdminOrder[] }) {
  const claims = patients.flatMap(p => p.clinical.claims); const appointmentCount = patients.reduce((sum, p) => sum + p.clinical.appointments.length, 0); const sales = orders.reduce((sum, o) => sum + (o.totals?.total ?? 0), 0);
  const rows = [['Appointments', appointmentCount, 'All scheduled and historical appointments'], ['Payments collected', money(payments.filter(p => p.status === 'Paid').reduce((s, p) => s + p.amount, 0)), 'Stripe Test Mode paid transactions'], ['Pharmacy sales', money(sales), 'Patient pharmacy orders'], ['Inventory value', money(medications.reduce((s, m) => s + m.price * m.stock, 0)), 'Current catalog price × stock'], ['Insurance claims', claims.length, 'Mock claims across patients']];
  return <div className="space-y-5"><PageHeading eyebrow="Insights" title="Reports" description="Operational summaries for appointments, payments, medication sales, inventory, and claims." /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map(([label, value, detail]) => <div key={String(label)} className={`${cardClass} p-5`}><p className="text-sm font-semibold text-muted-foreground">{label as string}</p><p className="mt-2 text-2xl font-bold text-primary">{value as string | number}</p><p className="mt-2 text-xs text-muted-foreground">{detail as string}</p></div>)}</div></div>;
}

function Audit({ events }: { events: ReturnType<typeof loadAuditEvents> }) {
  return <div className="space-y-5"><PageHeading eyebrow="Accountability" title="Audit log" description="Important administrator actions and patient record access are recorded locally for this prototype." /><div className={`${cardClass} overflow-hidden`}><div className="divide-y divide-border">{events.length ? events.map(event => <div key={event.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{event.action}</p><p className="text-xs text-muted-foreground">Target: {event.target} · Actor: {event.actor}</p></div><time className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString('en-PH')}</time></div>) : <EmptyState text="No audit events yet. View a patient or update an admin record to create one." />}</div></div></div>;
}

function Field({ name, label, defaultValue, type = 'text', step, required }: { name: string; label: string; defaultValue?: string | number; type?: string; step?: string; required?: boolean }) {
  return <label className="block text-sm font-semibold">{label}<input name={name} type={type} step={step} defaultValue={defaultValue} required={required} className={`${inputClass} mt-1.5`} /></label>;
}
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }
function SummaryLine({ label, value }: { label: string; value: string | number }) { return <div className="flex justify-between border-b border-border pb-2"><span className="text-muted-foreground">{label}</span><span className="font-bold">{value}</span></div>; }
function SimpleTable({ columns, rows }: { columns: string[]; rows: any[][] }) { return <div className={`${cardClass} overflow-hidden`}><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{columns.map(c => <th key={c} className="px-5 py-4">{c}</th>)}</tr></thead><tbody className="divide-y divide-border">{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="px-5 py-4 text-muted-foreground">{cell}</td>)}</tr>)}</tbody></table>{!rows.length && <EmptyState text="No records available." />}</div></div>; }
function ReadOnlyBlock({ title, items }: { title: string; items: string[] }) { return <div className={`${cardClass} p-5`}><div className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-primary" /><h2 className="font-bold">{title}</h2><span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Read-only</span></div><div className="mt-4 space-y-3">{items.map((item, i) => <pre key={i} className="whitespace-pre-wrap rounded-xl bg-muted/40 p-3 font-sans text-sm leading-relaxed text-muted-foreground">{item}</pre>)}{!items.length && <EmptyState text={`No ${title.toLowerCase()} available.`} />}</div></div>; }
function SoapSection({ title, text }: { title: string; text: string }) {
  return <div className="rounded-xl bg-muted/40 p-3"><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p><p className="whitespace-pre-line text-sm leading-relaxed">{text || 'Not documented.'}</p></div>;
}
function AdminImagingList({ records }: { records: ImagingRecord[] }) {
  const [selected, setSelected] = useState<ImagingRecord | null>(null);
  return <><div className={`${cardClass} p-5`}><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><ImageIcon className="h-5 w-5 text-primary" /><h2 className="text-lg font-bold">Imaging</h2></div><span className="text-xs text-muted-foreground">Read-only</span></div><div className="mt-4 grid gap-4 lg:grid-cols-2">{records.map(record => <div key={record.id} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{record.type} · {record.bodyArea}</p><p className="text-xs text-muted-foreground">{record.date} · {record.doctor}</p></div><StatusBadge value={record.status} /></div>{record.imageUrl && <button type="button" onClick={() => setSelected(record)} className="group relative mt-3 block w-full overflow-hidden rounded-lg bg-slate-900"><img src={record.imageUrl} alt={`${record.type} preview`} className="h-32 w-full object-cover transition group-hover:scale-[1.02]" /><span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-bold text-white"><Maximize2 className="h-3 w-3" /> Open preview</span></button>}<div className="mt-3 space-y-2 text-sm"><p><strong>Findings:</strong> {record.findings}</p><p><strong>Impression:</strong> {record.impression}</p></div><button type="button" onClick={() => downloadImagingReport(record)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold text-primary hover:bg-muted"><Download className="h-3.5 w-3.5" /> Download report</button></div>)}</div>{!records.length && <EmptyState text="No imaging records available." />}</div>{selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Admin imaging preview"><div className="relative max-h-[95vh] max-w-5xl overflow-auto rounded-2xl bg-card p-3 shadow-2xl"><button type="button" onClick={() => setSelected(null)} className="absolute right-5 top-5 z-10 rounded-full bg-black/70 p-2 text-white"><X className="h-5 w-5" /></button><img src={selected.imageUrl} alt={`${selected.type} enlarged preview`} className="max-h-[82vh] w-full rounded-xl object-contain" /><p className="px-2 pt-3 text-sm font-bold">{selected.type} · {selected.bodyArea} · {selected.date}</p></div></div>}</>;
}
function ImagingWorkspace({ patients }: { patients: AdminPatient[] }) {
  const allRecords = patients.flatMap(patient => patient.clinical.imaging.map(record => ({ ...record, patientId: patient.id, patientName: patient.name })));
  const [query, setQuery] = useState('');
  const [type, setType] = useState('All');
  const [date, setDate] = useState('');
  const filtered = allRecords.filter(record => `${record.patientName} ${record.patientId} ${record.doctor} ${record.bodyArea}`.toLowerCase().includes(query.toLowerCase()) && (type === 'All' || record.type === type) && (!date || record.date.toLowerCase().includes(date.toLowerCase())));
  return <div className="space-y-5"><PageHeading eyebrow="Clinical records" title="Imaging records" description="Search dummy imaging studies by patient, date, or imaging type. These records are for prototype testing only." /><div className={`${cardClass} p-4`}><div className="grid gap-3 md:grid-cols-[1fr_180px_180px]"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Patient, doctor, or body area" className={`${inputClass} pl-9`} /></div><select value={type} onChange={event => setType(event.target.value)} className={inputClass}><option>All</option><option>X-ray</option><option>Ultrasound</option><option>CT scan</option><option>MRI</option></select><input value={date} onChange={event => setDate(event.target.value)} placeholder="Filter date" className={inputClass} /></div></div><div className="grid gap-4 lg:grid-cols-2">{filtered.map(record => <div key={`${record.patientId}-${record.id}`} className={`${cardClass} p-5`}><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{record.type} · {record.bodyArea}</p><p className="text-xs text-muted-foreground">{record.patientName} · {record.date}</p><p className="text-xs text-muted-foreground">{record.doctor}</p></div><StatusBadge value={record.status} /></div>{record.imageUrl && <img src={record.imageUrl} alt={`${record.type} preview`} className="mt-4 h-40 w-full rounded-xl object-cover" />}<div className="mt-4 space-y-2 text-sm"><p><strong>Findings:</strong> {record.findings}</p><p><strong>Impression:</strong> {record.impression}</p></div><button type="button" onClick={() => downloadImagingReport(record)} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold text-primary hover:bg-muted"><Download className="h-3.5 w-3.5" /> Download report</button></div>)}{!filtered.length && <div className={`${cardClass} lg:col-span-2`}><EmptyState text="No imaging records match your filters." /></div>}</div></div>;
}
function EmptyState({ text }: { text: string }) { return <div className="p-10 text-center text-sm text-muted-foreground"><FileText className="mx-auto mb-3 h-8 w-8 opacity-30" />{text}</div>; }

function AdminEncounterClinicalPanel({ encounters, selectedEncounterId, onSelect, canEditClinical, editSoapNote }: { encounters: Encounter[]; selectedEncounterId: string; onSelect: (id: string) => void; canEditClinical: boolean; editSoapNote: (note: any) => void }) {
  const encounter = encounters.find(item => item.id === selectedEncounterId) ?? encounters[0];
  if (!encounter) {
    return <div className={`${cardClass} p-5`}><h2 className="font-bold">Clinical records</h2><EmptyState text="No completed encounter yet. Mark a confirmed appointment as Completed to create one." /></div>;
  }
  const items = (values: any[], empty: string, formatter: (value: any) => string) => values.length ? values.map(formatter) : [empty];
  return <div className="space-y-5">
    <div className={`${cardClass} p-5`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-widest text-primary">Encounter</p><h2 className="mt-1 text-xl font-bold">{encounter.encounterReference}</h2><p className="mt-1 text-sm text-muted-foreground">{encounter.date} · {encounter.doctor} · {encounter.specialty}</p><p className="text-xs text-muted-foreground">{encounter.clinic} · Appointment {encounter.appointmentId}</p></div>
        <select value={encounter.id} onChange={event => onSelect(event.target.value)} className={inputClass + ' md:w-72'}>{encounters.map(item => <option key={item.id} value={item.id}>{item.encounterReference} · {item.date}</option>)}</select>
      </div>
      <div className="mt-4 grid gap-3 rounded-xl bg-muted/40 p-4 text-sm sm:grid-cols-2"><Info label="Patient" value={encounter.patientName} /><Info label="Chief complaint" value={encounter.chiefComplaint} /><Info label="Appointment" value={`${encounter.appointmentDetails.date} · ${encounter.appointmentDetails.time}`} /><Info label="Attending doctor" value={encounter.doctor} /></div>
    </div>
    <div className={`${cardClass} p-5`}>
      <div className="flex items-center justify-between"><h2 className="font-bold">SOAP notes</h2><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${canEditClinical ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{canEditClinical ? 'Clinical editing enabled' : 'Read-only'}</span></div>
      {encounter.soapNotes.length ? <div className="mt-4 space-y-4">{encounter.soapNotes.map((note: any) => <div key={note.id} className="rounded-xl border border-border p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-bold">{note.doctor}</p><p className="text-xs text-muted-foreground">{note.date} · {note.consultationReference}</p></div>{canEditClinical && <button type="button" onClick={() => editSoapNote(note)} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold hover:bg-muted"><Pencil className="mr-1 inline h-3 w-3" /> Edit</button>}</div><div className="mt-3 grid gap-3 md:grid-cols-2"><SoapSection title="Subjective" text={note.subjective} /><SoapSection title="Objective" text={note.objective} /><SoapSection title="Assessment" text={note.assessment} /><SoapSection title="Plan" text={note.plan} /></div></div>)}</div> : <EmptyState text="This encounter has no SOAP notes yet." />}
    </div>
    <ReadOnlyBlock title="Diagnoses" items={items(encounter.diagnoses, 'This encounter has no diagnoses yet.', item => `${item.code} · ${item.description} · ${item.status} · ${item.date}`)} />
    <ReadOnlyBlock title="Prescriptions & medications" items={items([...encounter.prescriptions, ...encounter.medications], 'This encounter has no prescriptions or medications yet.', item => `${item.name} · ${item.dosage ?? ''} · ${item.instructions ?? ''}`)} />
    <ReadOnlyBlock title="Vitals" items={items(encounter.vitals, 'This encounter has no vitals yet.', item => `${item.date}: BP ${item.systolic}/${item.diastolic}, HR ${item.heartRate}, Temp ${item.temp}, Weight ${item.weight}`)} />
    <ReadOnlyBlock title="Laboratory results" items={items(encounter.laboratoryResults, 'This encounter has no laboratory results yet.', item => `${item.test} · ${item.result} · ${item.status} · ${item.date}`)} />
    <ReadOnlyBlock title="Imaging" items={items(encounter.imaging, 'This encounter has no imaging records yet.', item => `${item.type} · ${item.bodyArea} · ${item.impression} · ${item.date}`)} />
    <ReadOnlyBlock title="Clinical summary" items={encounter.clinicalSummary ? [encounter.clinicalSummary] : ['This encounter has no clinical summary yet.']} />
  </div>;
}

export default function Admin() {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  seedAdminData();
  const [section, setSection] = useState<Section>('overview');
  const [patients, setPatients] = useState(loadAdminPatients);
  const [medications, setMedications] = useState(loadAdminMedications);
  const [orders, setOrders] = useState(loadAdminOrders);
  const [payments, setPayments] = useState(loadAdminPayments);
  const [schedules, setSchedules] = useState(loadAdminSchedules);
  const [events, setEvents] = useState(loadAuditEvents);
  const [selectedPatient, setSelectedPatient] = useState<AdminPatient | null>(null);
  const appointments = useMemo(() => patients.flatMap(p => p.clinical.appointments), [patients]);
  const updatePatients = (value: AdminPatient[]) => { setPatients(value); saveAdminPatients(value); setEvents(loadAuditEvents()); };
  const updateMedications = (value: AdminMedication[]) => { setMedications(value); saveAdminMedications(value); setEvents(loadAuditEvents()); };
  const updateOrders = (value: AdminOrder[]) => { setOrders(value); saveAdminOrders(value); setEvents(loadAuditEvents()); };
  const updatePayments = (value: AdminPayment[]) => { setPayments(value); saveAdminPayments(value); setEvents(loadAuditEvents()); };
  const updateSchedules = (value: AdminSchedule[]) => { setSchedules(value); saveAdminSchedules(value); setEvents(loadAuditEvents()); };
  const handleLogout = () => { logout(); setLocation('/login'); };
  const content = selectedPatient ? <PatientProfile patient={selectedPatient} payments={payments} onBack={() => setSelectedPatient(null)} onUpdate={patient => { updatePatients(patients.map(p => p.id === patient.id ? patient : p)); setSelectedPatient(patient); }} /> :
    section === 'overview' ? <Overview patients={patients} appointments={appointments} payments={payments} medications={medications} orders={orders} /> :
    section === 'patients' ? <Patients patients={patients} onSelect={setSelectedPatient} onUpdate={patient => updatePatients(patients.map(p => p.id === patient.id ? patient : p))} /> :
    section === 'appointments' ? <Appointments patients={patients} schedules={schedules} onSchedules={updateSchedules} onPatients={updatePatients} /> :
    section === 'payments' ? <Payments payments={payments} onPayments={updatePayments} /> :
    section === 'medications' ? <Medications medications={medications} onMedications={updateMedications} /> :
    section === 'orders' ? <Orders orders={orders} patients={patients} onOrders={updateOrders} /> :
    section === 'imaging' ? <ImagingWorkspace patients={patients} /> :
    section === 'claims' ? <Claims patients={patients} onPatients={updatePatients} /> :
    section === 'reports' ? <Reports patients={patients} payments={payments} medications={medications} orders={orders} /> :
    <Audit events={events} />;
  return <AdminShell section={selectedPatient ? 'patients' : section} onSection={value => { setSelectedPatient(null); setSection(value); }} onLogout={handleLogout}>{content}</AdminShell>;
}