import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/layout/app-shell';
import { currentPatient } from '@/data/mock';
import { downloadImagingReport, type ImagingRecord } from '@/lib/clinical';
import { getCurrentSessionUser } from '@/hooks/use-auth';
import { createLegacyEncountersForPatient, type Encounter } from '@/lib/encounters';
import { serverMigrateRecords, serverRecords } from '@/lib/server';
import { Activity, Download, FileText, FlaskConical, Image as ImageIcon, Maximize2, Pill, Stethoscope, X } from 'lucide-react';

const cardClass = 'rounded-2xl border border-border bg-card shadow-sm';

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground"><FileText className="mx-auto mb-2 h-7 w-7 opacity-30" />{text}</div>;
}

function RecordList({ title, icon: Icon, items, empty }: { title: string; icon: any; items: string[]; empty: string }) {
  return <section className={`${cardClass} p-5`}><div className="flex items-center gap-2"><Icon className="h-5 w-5 text-primary" /><h2 className="font-bold">{title}</h2><span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Encounter-scoped</span></div><div className="mt-4 space-y-2">{items.length ? items.map((item, index) => <div key={`${title}-${index}`} className="rounded-xl bg-muted/40 p-3 text-sm whitespace-pre-line">{item}</div>) : <EmptyState text={empty} />}</div></section>;
}

export default function Records() {
  const session = getCurrentSessionUser();
  const patientId = (session as any)?.id ?? currentPatient.id;
  const patientName = session?.name ?? currentPatient.name;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [selectedEncounterId, setSelectedEncounterId] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImagingRecord | null>(null);
  const selectedEncounter = encounters.find(item => item.id === selectedEncounterId) ?? encounters[0];

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    serverRecords(patientId)
      .then(async response => {
        if (!active) return;
        if (response.encounters.length) {
          setEncounters(response.encounters);
          return;
        }
        if (session?.email?.toLowerCase() !== 'juan@example.com') {
          setEncounters([]);
          return;
        }
        const legacy = createLegacyEncountersForPatient({ id: patientId, name: patientName });
        if (!legacy.length) {
          setEncounters([]);
          return;
        }
        const migrated = await serverMigrateRecords(patientId, legacy);
        if (active) setEncounters(migrated.encounters);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load shared clinical records.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [patientId, patientName]);

  const encounterImages = (selectedEncounter?.imaging ?? []) as ImagingRecord[];
  return <AppShell title="Medical Records">
    {loading ? <div className="h-96 animate-pulse rounded-2xl border border-border bg-card" /> : error ? <EmptyState text={error} /> : <div className="space-y-6">
      <div className={`${cardClass} p-5`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-widest text-primary">Clinical Records</p><h1 className="mt-1 text-2xl font-bold">Encounter history</h1><p className="mt-1 text-sm text-muted-foreground">Select a completed encounter to view only the records associated with that appointment.</p></div>
          <select value={selectedEncounter?.id ?? ''} onChange={event => setSelectedEncounterId(event.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary lg:w-80">
            {encounters.map(encounter => <option key={encounter.id} value={encounter.id}>{encounter.encounterReference} · {encounter.date}</option>)}
          </select>
        </div>
      </div>
      {!selectedEncounter ? <EmptyState text="No appointment has been completed yet. Clinical records will appear here after an authorized user completes a confirmed appointment." /> : <div className="space-y-5">
        <div className={`${cardClass} overflow-hidden`}><div className="bg-gradient-to-br from-primary/10 via-card to-card p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">{selectedEncounter.encounterReference}</p><h2 className="mt-1 text-xl font-bold">{selectedEncounter.chiefComplaint}</h2><p className="mt-1 text-sm text-primary">{selectedEncounter.doctor} · {selectedEncounter.specialty}</p><p className="mt-1 text-xs text-muted-foreground">{selectedEncounter.clinic}</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Completed</span></div><div className="mt-4 grid gap-3 rounded-xl bg-background/70 p-4 text-sm sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Appointment</p><p className="font-semibold">{selectedEncounter.appointmentDetails.date} · {selectedEncounter.appointmentDetails.time}</p></div><div><p className="text-xs text-muted-foreground">Attending doctor</p><p className="font-semibold">{selectedEncounter.doctor}</p></div><div><p className="text-xs text-muted-foreground">Appointment ID</p><p className="font-mono text-xs font-semibold">{selectedEncounter.appointmentId}</p></div></div></div></div>
        <RecordList title="Clinical summary" icon={FileText} items={selectedEncounter.clinicalSummary ? [selectedEncounter.clinicalSummary] : []} empty="This encounter has no clinical summary yet." />
        <section className={`${cardClass} p-5`}><div className="flex items-center gap-2"><Stethoscope className="h-5 w-5 text-primary" /><h2 className="font-bold">SOAP notes</h2><span className="ml-auto rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-800">Read-only for patients</span></div>{selectedEncounter.soapNotes.length ? <div className="mt-4 space-y-4">{selectedEncounter.soapNotes.map((note: any) => <div key={note.id} className="rounded-xl border border-border p-4"><div className="flex items-center justify-between gap-3 border-b border-border pb-3"><div><p className="font-bold">{note.doctor}</p><p className="text-xs text-muted-foreground">{note.date} · {note.consultationReference}</p></div><span className="text-[10px] font-bold uppercase text-muted-foreground">{note.status}</span></div><div className="mt-3 grid gap-3 md:grid-cols-2">{[['Subjective', note.subjective], ['Objective', note.objective], ['Assessment', note.assessment], ['Plan', note.plan]].map(([label, text]) => <div key={String(label)} className="rounded-xl bg-muted/40 p-3"><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="whitespace-pre-line text-sm">{text}</p></div>)}</div></div>)}</div> : <div className="mt-4"><EmptyState text="This encounter has no SOAP notes yet." /></div>}</section>
        <div className="grid gap-5 lg:grid-cols-2">
          <RecordList title="Diagnoses" icon={Activity} items={selectedEncounter.diagnoses.map(item => `${item.code} · ${item.description} · ${item.status} · ${item.date}`)} empty="This encounter has no diagnoses yet." />
          <RecordList title="Prescriptions & medications" icon={Pill} items={[...selectedEncounter.prescriptions, ...selectedEncounter.medications].map(item => `${item.name} · ${item.dosage ?? ''} · ${item.instructions ?? ''}`)} empty="This encounter has no prescriptions or medications yet." />
          <RecordList title="Vitals" icon={Activity} items={selectedEncounter.vitals.map(item => `${item.date}: BP ${item.systolic}/${item.diastolic}, HR ${item.heartRate}, Temp ${item.temp}, Weight ${item.weight}`)} empty="This encounter has no vitals yet." />
          <RecordList title="Laboratory results" icon={FlaskConical} items={selectedEncounter.laboratoryResults.map(item => `${item.test} · ${item.result} · ${item.range} · ${item.status} · ${item.date}`)} empty="This encounter has no laboratory results yet." />
        </div>
        <section className={`${cardClass} p-5`}><div className="flex items-center gap-2"><ImageIcon className="h-5 w-5 text-primary" /><h2 className="font-bold">Imaging</h2><span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Encounter-scoped</span></div>{encounterImages.length ? <div className="mt-4 grid gap-4 md:grid-cols-2">{encounterImages.map(record => <div key={record.id} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{record.type} · {record.bodyArea}</p><p className="text-xs text-muted-foreground">{record.date} · {record.doctor}</p></div><span className="text-[10px] font-bold uppercase text-muted-foreground">{record.status}</span></div>{record.imageUrl && <button type="button" onClick={() => setSelectedImage(record)} className="group relative mt-3 block w-full overflow-hidden rounded-xl bg-slate-900"><img src={record.imageUrl} alt={`${record.type} preview`} className="h-36 w-full object-cover transition group-hover:scale-[1.02]" /><span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-bold text-white"><Maximize2 className="h-3 w-3" /> Open preview</span></button>}<p className="mt-3 text-sm"><strong>Findings:</strong> {record.findings}</p><p className="mt-2 text-sm"><strong>Impression:</strong> {record.impression}</p><button type="button" onClick={() => downloadImagingReport(record)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold text-primary hover:bg-muted"><Download className="h-3.5 w-3.5" /> Download report</button></div>)}</div> : <div className="mt-4"><EmptyState text="This encounter has no imaging records yet." /></div>}</section>
        <section className={`${cardClass} p-5`}><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /><h2 className="font-bold">Encounter billing</h2><span className="ml-auto text-xs font-mono text-muted-foreground">{selectedEncounter.encounterReference}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[['Consultation fee', selectedEncounter.billing.consultationFee], ['Laboratory charges', selectedEncounter.billing.laboratoryCharges], ['Imaging charges', selectedEncounter.billing.imagingCharges], ['Pharmacy charges', selectedEncounter.billing.pharmacyCharges], ['Insurance coverage', selectedEncounter.billing.insuranceCoverage], ['Payments', selectedEncounter.billing.payments.reduce((sum, payment) => sum + payment.amount, 0)]].map(([label, amount]) => <div key={String(label)} className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-bold">₱{Number(amount).toFixed(2)}</p></div>)}</div>{!selectedEncounter.billing.relatedBillIds.length && <p className="mt-3 text-xs text-muted-foreground">No bill has been linked to this encounter yet.</p>}</section>
      </div>}
    </div>}
    {selectedImage && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Imaging preview"><div className="relative max-h-[95vh] max-w-5xl overflow-auto rounded-2xl bg-card p-3 shadow-2xl"><button type="button" onClick={() => setSelectedImage(null)} className="absolute right-5 top-5 z-10 rounded-full bg-black/70 p-2 text-white"><X className="h-5 w-5" /></button><img src={selectedImage.imageUrl} alt={`${selectedImage.type} enlarged preview`} className="max-h-[82vh] w-full rounded-xl object-contain" /></div></div>}
  </AppShell>;
}