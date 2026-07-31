import { useState, useEffect } from 'react';
import AppShell from '@/components/layout/app-shell';
import { upcomingAppointments, pastAppointments, specialties, doctors } from '@/data/mock';
import { Calendar as CalendarIcon, Clock, MapPin, User, ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { calculateInsuranceEstimate, createOrUpdateClaim, loadInsurance } from '@/lib/insurance';
import { getPatientEncounters } from '@/lib/encounters';
import { serverAppointments, serverCreateAppointment, serverUpdateAppointmentStatus } from '@/lib/server';

// ─── Types ────────────────────────────────────────────────────────────────────

type EmailStatus = 'sent' | 'failed' | 'pending';

type Appointment = {
  id: string;
  date: string;
  time: string;
  doctor: (typeof doctors)[number];
  status: string;
  reference?: string;
  emailStatus?: EmailStatus;
  emailMessageId?: string;
  billing?: {
    originalAmount: number;
    estimatedInsuranceCoverage: number;
    patientBalance: number;
  };
};

// ─── localStorage helpers ─────────────────────────────────────────────────────

const STORAGE_KEY = 'sugbodoc_appointments';
const USER_KEY = 'sugbodoc_current_user';
const MOCK_APPOINTMENT_FEE = 800;

function loadAppointments(): Appointment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Appointment[];
  } catch {
    // ignore
  }
  return upcomingAppointments;
}

function saveAppointments(apts: Appointment[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(apts));
  } catch {
    // ignore
  }
}

function getCurrentUser(): { name: string; email: string } | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) return JSON.parse(raw) as { name: string; email: string };
  } catch {
    // ignore
  }
  return null;
}

function generateReference(): string {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `APT-${num}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Appointments() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [localAppointments, setLocalAppointments] = useState<Appointment[]>([]);

  // Booking state
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<(typeof doctors)[number] | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  const { toast } = useToast();
  const insurance = loadInsurance();
  const appointmentEstimate = calculateInsuranceEstimate(MOCK_APPOINTMENT_FEE, insurance, 'appointment');

  // Load persisted appointments on mount
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const response = await serverAppointments();
        if (active) {
          setLocalAppointments(response.appointments as Appointment[]);
          saveAppointments(response.appointments as Appointment[]);
        }
      } catch {
        if (active) setLocalAppointments(loadAppointments());
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  const getStatusColor = (status: string) => {
    if (status === 'Confirmed' || status === 'Completed')
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (status === 'Pending')
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400';
  };

  const cancelAppointment = (id: string) => {
    const updated = localAppointments.filter(apt => apt.id !== id);
    setLocalAppointments(updated);
    saveAppointments(updated);
    void serverUpdateAppointmentStatus(id, 'Cancelled').catch(() => undefined);
    toast({
      title: 'Appointment Cancelled',
      description: 'Your appointment has been successfully cancelled.',
      variant: 'destructive',
    });
  };

  const resetBooking = () => {
    setIsBookingOpen(false);
    setBookingStep(1);
    setSelectedSpecialty('');
    setSelectedDoctor(null);
    setSelectedDate('');
    setSelectedTime('');
  };

  const confirmBooking = async () => {
    if (!selectedDoctor || !selectedDate || !selectedTime) return;
    if (isConfirming) return; // prevent double-submit

    const currentUser = getCurrentUser();
    setIsConfirming(true);
    const billing = {
      originalAmount: appointmentEstimate.originalAmount,
      estimatedInsuranceCoverage: appointmentEstimate.estimatedCoverage,
      patientBalance: appointmentEstimate.patientBalance,
    };

    let newApt: Appointment;
    try {
      const response = await serverCreateAppointment({
        date: selectedDate,
        time: selectedTime,
        doctor: selectedDoctor,
        billing,
      });
      newApt = response.appointment as Appointment;
    } catch {
      // Preserve the existing prototype path if the shared API is unavailable.
      newApt = {
        id: `apt_${Date.now()}`,
        date: selectedDate,
        time: selectedTime,
        doctor: selectedDoctor,
        status: 'Pending',
        reference: generateReference(),
        emailStatus: 'pending',
        billing,
      };
    }

    const updated = [newApt, ...localAppointments];
    setLocalAppointments(updated);
    saveAppointments(updated);
    const reference = newApt.reference ?? generateReference();

    // 2. Attempt email through the server.
    let emailSent = false;
    let emailMessageId: string | undefined;
    let emailError = '';
    try {
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
      const res = await fetch(`${BASE}/api/notifications/appointment-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentReference: reference,
          patientName: currentUser?.name ?? 'Patient',
          email: currentUser?.email,
          doctorName: selectedDoctor.name,
          specialty: selectedDoctor.specialty,
          clinicName: selectedDoctor.clinic,
          appointmentDate: selectedDate,
          appointmentTime: selectedTime,
          status: newApt.status,
        }),
      });
      if (res.ok) {
        const json = await res.json() as { sent: boolean; messageId?: string; error?: string };
        emailSent = json.sent;
        emailMessageId = json.messageId;
        emailError = json.error ?? '';
      } else {
        emailError = 'Notification service unavailable';
      }
    } catch {
      emailError = 'Notification service unavailable';
    }

    // 3. Save the email notification result.
    const finalStatus: EmailStatus = emailSent ? 'sent' : 'failed';
    const finalAppointments = updated.map(apt =>
      apt.id === newApt.id
        ? { ...apt, emailStatus: finalStatus, emailMessageId }
        : apt,
    );
    setLocalAppointments(finalAppointments);
    saveAppointments(finalAppointments);
    createOrUpdateClaim({
      relatedType: 'appointment',
      relatedId: reference,
      relatedLabel: `${selectedDoctor.name} · ${selectedDate}`,
      originalAmount: appointmentEstimate.originalAmount,
      estimatedCoverage: appointmentEstimate.estimatedCoverage,
      patientBalance: appointmentEstimate.patientBalance,
      status: 'Processing',
      provider: insurance?.provider ?? 'Testing estimate',
    });

    setIsConfirming(false);
    resetBooking();

    // 4. Show the email result.
    toast({
      title: 'Appointment Booked',
      description: `Reference: ${reference}. Email: ${emailSent ? 'sent' : `not sent${emailError ? ` (${emailError})` : ''}`}.`,
      variant: emailSent ? undefined : 'destructive',
    });
  };

  const appointmentsList: Appointment[] =
    activeTab === 'upcoming' ? localAppointments : (pastAppointments as Appointment[]);
  const completedEncounters = getPatientEncounters();

  return (
    <AppShell title="Appointments">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex bg-muted/50 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'upcoming' ? 'bg-card text-foreground shadow-sm border border-border/50' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'past' ? 'bg-card text-foreground shadow-sm border border-border/50' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Past
          </button>
        </div>

        <button
          onClick={() => setIsBookingOpen(true)}
          className="bg-primary text-primary-foreground h-11 px-6 rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2 justify-center"
        >
          <CalendarIcon className="h-4 w-4" />
          Book New Appointment
        </button>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-muted rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 animate-in fade-in duration-500">
          {appointmentsList.length > 0 ? (
            appointmentsList.map(apt => (
              <div
                key={apt.id}
                className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col md:flex-row gap-5 justify-between"
              >
                <div className="flex gap-5 items-start">
                  <div className="hidden md:flex h-14 w-14 rounded-full bg-primary/10 items-center justify-center shrink-0 border border-primary/20">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-foreground">{apt.doctor.name}</h3>
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${getStatusColor(apt.status)}`}
                      >
                        {apt.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-primary mb-3">{apt.doctor.specialty}</p>

                    {apt.reference && (
                      <p className="text-xs text-muted-foreground mb-2 font-mono">
                        Ref: {apt.reference}
                        {apt.emailStatus === 'sent' && (
                          <span className="ml-2 text-emerald-600 font-sans font-medium">
                            Email sent
                          </span>
                        )}
                        {apt.emailStatus === 'failed' && (
                          <span className="ml-2 text-amber-600 font-sans font-medium">
                            Email failed
                          </span>
                        )}
                      </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                        <span>{apt.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                        <span>{apt.time}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                        <span className="truncate" title={apt.doctor.clinic}>
                          {apt.doctor.clinic}
                        </span>
                      </div>
                    </div>
                    {apt.billing && (
                      <div className="mt-3 rounded-lg border border-primary/10 bg-primary/5 px-3 py-2 text-xs">
                        <span className="font-semibold text-primary">Insurance estimate:</span>{' '}
                        ₱{apt.billing.estimatedInsuranceCoverage.toFixed(2)} covered ·{' '}
                        <span className="font-bold">₱{apt.billing.patientBalance.toFixed(2)} patient balance</span>
                      </div>
                    )}
                    {apt.status === 'Completed' && (
                      <p className="mt-3 text-xs font-semibold text-emerald-700">
                        Encounter: {completedEncounters.find(encounter => encounter.appointmentId === apt.id)?.encounterReference ?? 'Linked clinical record'}
                      </p>
                    )}
                  </div>
                </div>

                {activeTab === 'upcoming' && (
                  <div className="flex md:flex-col gap-2 shrink-0 md:w-32 mt-2 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-border">
                    <button className="flex-1 bg-secondary text-secondary-foreground text-xs font-medium py-2 px-3 rounded-lg hover:bg-secondary/90 transition-colors">
                      Reschedule
                    </button>
                    <button
                      onClick={() => cancelAppointment(apt.id)}
                      className="flex-1 bg-destructive/10 text-destructive text-xs font-medium py-2 px-3 rounded-lg hover:bg-destructive/20 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-16 bg-card border border-border rounded-2xl border-dashed">
              <CalendarIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">
                No {activeTab} appointments
              </h3>
              <p className="text-sm text-muted-foreground">
                When you book an appointment, it will show up here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Booking Modal */}
      {isBookingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold">Book Appointment</h2>
              <button
                onClick={resetBooking}
                disabled={isConfirming}
                className="text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {/* Step indicator */}
              <div className="flex items-center justify-between mb-8 relative">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-muted -z-10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${((bookingStep - 1) / 3) * 100}%` }}
                  />
                </div>
                {[1, 2, 3, 4].map(step => (
                  <div
                    key={step}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 bg-card transition-colors ${step <= bookingStep ? 'border-primary text-primary' : 'border-muted text-muted-foreground'} ${step === bookingStep ? 'ring-4 ring-primary/20' : ''}`}
                  >
                    {step < bookingStep ? <Check className="h-4 w-4" /> : step}
                  </div>
                ))}
              </div>

              {bookingStep === 1 && (
                <div className="space-y-4 animate-in slide-in-from-right-4">
                  <h3 className="text-lg font-semibold mb-4">Select Specialty</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {specialties.map(spec => (
                      <button
                        key={spec}
                        onClick={() => setSelectedSpecialty(spec)}
                        className={`p-4 rounded-xl border text-left transition-all ${selectedSpecialty === spec ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card hover:border-primary/50 text-foreground'}`}
                      >
                        <span className="font-medium text-sm">{spec}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {bookingStep === 2 && (
                <div className="space-y-4 animate-in slide-in-from-right-4">
                  <h3 className="text-lg font-semibold mb-4">Select Doctor</h3>
                  <div className="grid gap-3">
                    {doctors
                      .filter(d => !selectedSpecialty || d.specialty === selectedSpecialty)
                      .map(doc => (
                        <button
                          key={doc.id}
                          onClick={() => setSelectedDoctor(doc)}
                          className={`p-4 rounded-xl border text-left flex items-center gap-4 transition-all ${selectedDoctor?.id === doc.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'}`}
                        >
                          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold shrink-0">
                            {doc.initials}
                          </div>
                          <div>
                            <div className="font-bold text-foreground">{doc.name}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {doc.specialty} • {doc.clinic}
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {bookingStep === 3 && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Select Date</h3>
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 snap-x">
                      {['Sep 01, 2026', 'Sep 02, 2026', 'Sep 03, 2026', 'Sep 04, 2026', 'Sep 05, 2026'].map(
                        date => (
                          <button
                            key={date}
                            onClick={() => setSelectedDate(date)}
                            className={`shrink-0 snap-start p-3 w-24 rounded-xl border text-center transition-all ${selectedDate === date ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50 text-foreground'}`}
                          >
                            <div className="text-xs opacity-80 uppercase font-semibold">
                              {date.split(' ')[0]}
                            </div>
                            <div className="text-xl font-bold mt-1">
                              {date.split(' ')[1].replace(',', '')}
                            </div>
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Select Time</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {['09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:30 PM'].map(
                        time => (
                          <button
                            key={time}
                            onClick={() => setSelectedTime(time)}
                            className={`p-3 rounded-xl border text-center transition-all ${selectedTime === time ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50 text-foreground'}`}
                          >
                            <span className="font-medium text-sm">{time}</span>
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              )}

              {bookingStep === 4 && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                  <h3 className="text-lg font-semibold text-center mb-6">Confirm Appointment</h3>
                  <div className="bg-muted/30 rounded-2xl p-6 space-y-4 max-w-md mx-auto border border-border">
                    <div className="flex items-start gap-4 pb-4 border-b border-border">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                        {selectedDoctor?.initials}
                      </div>
                      <div>
                        <div className="font-bold text-foreground text-lg">{selectedDoctor?.name}</div>
                        <div className="text-sm text-primary font-medium">{selectedDoctor?.specialty}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Date</p>
                        <p className="font-medium">{selectedDate}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Time</p>
                        <p className="font-medium">{selectedTime}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Clinic</p>
                        <p className="font-medium">{selectedDoctor?.clinic}</p>
                      </div>
                    </div>
                    {(() => {
                      const user = getCurrentUser();
                      return user?.email ? (
                        <div className="pt-3 border-t border-border">
                          <p className="text-xs text-muted-foreground">
                            Confirmation will be sent to{' '}
                            <span className="font-medium text-foreground">{user.email}</span>
                          </p>
                        </div>
                      ) : null;
                    })()}
                    <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-bold text-primary">Insurance estimate</p>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Testing only</span>
                      </div>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Appointment fee</span><span className="font-medium">₱{appointmentEstimate.originalAmount.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Estimated coverage</span><span className="font-medium text-emerald-600">−₱{appointmentEstimate.estimatedCoverage.toFixed(2)}</span></div>
                        <div className="flex justify-between border-t border-primary/10 pt-1.5 font-bold"><span>Estimated patient balance</span><span className="text-primary">₱{appointmentEstimate.patientBalance.toFixed(2)}</span></div>
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {insurance?.provider ? `${insurance.provider} · ${Math.round(appointmentEstimate.coveragePercent * 100)}% estimate` : 'Add an active plan in Profile to preview coverage.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-6 border-t border-border flex justify-between shrink-0 bg-muted/20">
              <button
                onClick={() => setBookingStep(prev => prev - 1)}
                disabled={isConfirming}
                className={`px-4 py-2 rounded-xl font-medium text-sm text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1 disabled:opacity-40 ${bookingStep === 1 ? 'invisible' : ''}`}
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>

              {bookingStep < 4 ? (
                <button
                  onClick={() => setBookingStep(prev => prev + 1)}
                  disabled={
                    (bookingStep === 1 && !selectedSpecialty) ||
                    (bookingStep === 2 && !selectedDoctor) ||
                    (bookingStep === 3 && (!selectedDate || !selectedTime))
                  }
                  className="bg-primary text-primary-foreground h-11 px-6 rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  Continue <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={confirmBooking}
                  disabled={isConfirming}
                  className="bg-primary text-primary-foreground h-11 px-6 rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors shadow-md flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isConfirming ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Booking...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Confirm Booking
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
