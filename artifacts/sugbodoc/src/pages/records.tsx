import { useState, useEffect } from 'react';
import AppShell from '@/components/layout/app-shell';
import { recordsTabs, encounters, vitalsData, prescriptions, labResults, diagnoses } from '@/data/mock';
import { getImagingRecords, getSoapNotes, downloadImagingReport, type ImagingRecord } from '@/lib/clinical';
import { FileText, Activity, Pill, FlaskConical, Stethoscope, AlertCircle, TrendingUp, Download, Image as ImageIcon, X, Maximize2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Records() {
  const [activeTab, setActiveTab] = useState(recordsTabs[0]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<ImagingRecord | null>(null);
  const soapNotes = getSoapNotes();
  const imaging = getImagingRecords();

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(timer);
  }, [activeTab]);

  return (
    <AppShell title="Medical Records">
      {/* Horizontal Scrollable Tabs */}
      <div className="flex overflow-x-auto pb-4 mb-6 -mx-4 px-4 lg:mx-0 lg:px-0 hide-scrollbar snap-x">
        <div className="flex bg-card border border-border p-1 rounded-xl w-max">
          {recordsTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all snap-start ${
                activeTab === tab 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-[400px] bg-card rounded-2xl border border-border"></div>
        </div>
      ) : (
        <div className="animate-in fade-in duration-500 space-y-6">
          
          {/* ENCOUNTERS */}
          {activeTab === 'Encounters' && (
            <div className="grid gap-4">
              {encounters.map(enc => (
                <div key={enc.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-lg text-foreground">{enc.complaint}</h3>
                      <p className="text-sm text-primary font-medium">{enc.doctor}</p>
                    </div>
                    <span className="text-xs font-medium bg-muted text-muted-foreground px-3 py-1 rounded-full">{enc.date}</span>
                  </div>
                  <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">{enc.summary}</p>
                </div>
              ))}
            </div>
          )}

          {/* VITALS */}
          {activeTab === 'Vitals' && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-lg text-foreground">Blood Pressure Trend</h3>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={vitalsData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ fontSize: '14px', fontWeight: 600 }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                      <Line type="monotone" name="Systolic" dataKey="systolic" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" name="Diastolic" dataKey="diastolic" stroke="var(--color-secondary)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Date</th>
                        <th className="px-6 py-4 font-semibold">BP (mmHg)</th>
                        <th className="px-6 py-4 font-semibold">Heart Rate</th>
                        <th className="px-6 py-4 font-semibold">Weight (kg)</th>
                        <th className="px-6 py-4 font-semibold">Temp (°C)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {vitalsData.slice().reverse().map((vital, i) => (
                        <tr key={i} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4 font-medium text-foreground">{vital.date}</td>
                          <td className="px-6 py-4">{vital.systolic}/{vital.diastolic}</td>
                          <td className="px-6 py-4">{vital.heartRate} bpm</td>
                          <td className="px-6 py-4">{vital.weight}</td>
                          <td className="px-6 py-4">{vital.temp}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PRESCRIPTIONS */}
          {activeTab === 'Prescriptions' && (
            <div className="grid gap-4 sm:grid-cols-2">
              {prescriptions.map(rx => {
                let badgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
                if (rx.status === 'Refill Needed') badgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
                if (rx.status === 'Completed') badgeClass = 'bg-muted text-muted-foreground';

                return (
                  <div key={rx.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Pill className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground text-lg leading-tight">{rx.name}</h3>
                          <p className="text-sm text-primary font-medium">{rx.dosage}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider shrink-0 ${badgeClass}`}>
                        {rx.status}
                      </span>
                    </div>
                    <div className="mt-auto bg-muted/50 p-3 rounded-lg border border-border/50 text-sm text-muted-foreground">
                      {rx.instructions}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* LAB RESULTS */}
          {activeTab === 'Lab Results' && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-primary" />
                    <h3 className="font-bold text-lg text-foreground">Recent Lab Results</h3>
                  </div>
                  <span className="text-sm text-muted-foreground">From Jun 05, 2024</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-muted/30 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Test Name</th>
                        <th className="px-6 py-4 font-semibold">Result</th>
                        <th className="px-6 py-4 font-semibold">Reference Range</th>
                        <th className="px-6 py-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {labResults.map(lab => (
                        <tr key={lab.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4 font-medium text-foreground">{lab.test}</td>
                          <td className={`px-6 py-4 font-bold ${lab.status === 'Abnormal' ? 'text-destructive' : 'text-foreground'}`}>
                            {lab.result}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">{lab.range}</td>
                          <td className="px-6 py-4">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${lab.status === 'Normal' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-destructive/10 text-destructive'}`}>
                              {lab.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2"><ImageIcon className="h-5 w-5 text-primary" /><h3 className="font-bold text-lg">Imaging</h3></div>
                  <span className="text-xs text-muted-foreground">Dummy prototype records</span>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {imaging.map(record => (
                    <div key={record.id} className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-bold">{record.type} · {record.bodyArea}</p><p className="text-xs text-muted-foreground">{record.date} · {record.doctor}</p></div>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-800">{record.status}</span>
                      </div>
                      {record.imageUrl && <button type="button" onClick={() => setSelectedImage(record)} className="group relative mt-4 block w-full overflow-hidden rounded-lg border border-border bg-slate-900"><img src={record.imageUrl} alt={`${record.type} preview`} className="h-36 w-full object-cover transition group-hover:scale-[1.02]" /><span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-black/70 px-2 py-1 text-xs font-semibold text-white"><Maximize2 className="h-3 w-3" /> Open image</span></button>}
                      <div className="mt-4 space-y-2 text-sm"><p><strong>Findings:</strong> {record.findings}</p><p><strong>Impression:</strong> {record.impression}</p></div>
                      <button type="button" onClick={() => downloadImagingReport(record)} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold text-primary hover:bg-muted"><Download className="h-3.5 w-3.5" /> Download mock report</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SOAP NOTES */}
          {activeTab === 'SOAP Notes' && (
            <div className="space-y-6">
              {soapNotes.map(note => (
                <div key={note.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                  <div className="flex justify-between items-center pb-4 mb-4 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-5 w-5 text-primary" />
                      <h3 className="font-bold text-lg text-foreground">{note.doctor}</h3>
                    </div>
                    <div className="text-right text-xs text-muted-foreground"><p>{note.date} · {note.status}</p><p>{note.consultationReference}</p></div>
                  </div>
                  
                  <div className="space-y-4 text-sm">
                    <div>
                      <h4 className="font-bold text-foreground mb-1 text-xs uppercase tracking-wider text-muted-foreground">Subjective</h4>
                      <p className="text-foreground/90 bg-muted/30 p-3 rounded-lg">{note.subjective}</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground mb-1 text-xs uppercase tracking-wider text-muted-foreground">Objective</h4>
                      <p className="text-foreground/90 bg-muted/30 p-3 rounded-lg">{note.objective}</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground mb-1 text-xs uppercase tracking-wider text-muted-foreground">Assessment</h4>
                      <p className="text-foreground/90 bg-muted/30 p-3 rounded-lg whitespace-pre-line">{note.assessment}</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground mb-1 text-xs uppercase tracking-wider text-muted-foreground">Plan</h4>
                      <p className="text-foreground/90 bg-muted/30 p-3 rounded-lg whitespace-pre-line">{note.plan}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* DIAGNOSES */}
          {activeTab === 'Diagnoses' && (
            <div className="grid gap-3">
              {diagnoses.map(dx => (
                <div key={dx.id} className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between hover:bg-muted/20 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${dx.status === 'Active' ? 'bg-primary' : 'bg-muted-foreground'}`}></div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded border border-border">{dx.code}</span>
                        <span className="text-xs text-muted-foreground">Since {dx.date}</span>
                      </div>
                      <h3 className={`font-medium ${dx.status === 'Active' ? 'text-foreground' : 'text-muted-foreground line-through decoration-muted-foreground/30'}`}>
                        {dx.description}
                      </h3>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-semibold uppercase tracking-wider ${dx.status === 'Active' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {dx.status}
                  </span>
                </div>
              ))}
            </div>
          )}

        </div>
      )}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Imaging preview">
          <div className="relative max-h-[95vh] max-w-5xl overflow-auto rounded-2xl bg-card p-3 shadow-2xl">
            <button type="button" onClick={() => setSelectedImage(null)} className="absolute right-5 top-5 z-10 rounded-full bg-black/70 p-2 text-white hover:bg-black"><X className="h-5 w-5" /></button>
            <img src={selectedImage.imageUrl} alt={`${selectedImage.type} enlarged preview`} className="max-h-[82vh] w-full rounded-xl object-contain" />
            <div className="px-2 pt-3 text-sm"><p className="font-bold">{selectedImage.type} · {selectedImage.bodyArea}</p><p className="text-xs text-muted-foreground">{selectedImage.date} · {selectedImage.doctor}</p></div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
