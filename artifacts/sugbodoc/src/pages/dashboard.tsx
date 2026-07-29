import { useState, useEffect } from 'react';
import AppShell from '@/components/layout/app-shell';
import { upcomingAppointments, inbox, bills, activities } from '@/data/mock';
import { Link, useLocation } from 'wouter';
import { Calendar, MessageSquare, FileText, CreditCard, Clock, ChevronRight, Activity } from 'lucide-react';
import { STORAGE_KEYS } from '@/hooks/use-auth';

type CurrentUser = {
  name?: string;
  initials?: string;
  email?: string;
};

function loadCurrentUser(): CurrentUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return raw ? (JSON.parse(raw) as CurrentUser) : null;
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [user] = useState<CurrentUser | null>(loadCurrentUser);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Simulate loading data
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const nextAppointment = upcomingAppointments[0];
  const unreadMessages = inbox.filter(msg => msg.unread).length;
  const pendingAmount = bills.reduce((acc, bill) => acc + bill.amount, 0);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
  };

  const getStatusColor = (status: string) => {
    if (status === 'Confirmed') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (status === 'Pending') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400';
  };

  if (loading) {
    return (
      <AppShell title="Dashboard">
        <div className="space-y-6 animate-pulse">
          <div className="h-16 w-48 bg-muted rounded-xl mb-8"></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-muted rounded-2xl"></div>)}
          </div>
          <div className="h-[300px] bg-muted rounded-2xl"></div>
        </div>
      </AppShell>
    );
  }

  if (!user?.name || !user.email) {
    return (
      <AppShell title="Dashboard">
        <div className="max-w-xl mx-auto rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <h2 className="text-xl font-bold text-foreground">Patient information unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We couldn’t find the logged-in patient’s information. Please sign in again.
          </p>
          <button
            onClick={() => setLocation('/login')}
            className="mt-6 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Return to Sign In
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Dashboard">
      <div className="space-y-8 animate-in fade-in duration-500">
        
        {/* Welcome Section */}
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
              <span className="text-xl font-bold text-primary">{user.initials || user.name.slice(0, 2).toUpperCase()}</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Good morning, {user.name.trim().split(/\s+/)[0]}</h2>
            <p className="text-muted-foreground">Here is your health overview today.</p>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/appointments" className="bg-card border border-border p-4 rounded-2xl shadow-sm hover:border-primary/50 transition-colors group block">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground font-medium">Next Visit</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{nextAppointment ? nextAppointment.date : 'None'}</p>
          </Link>

          <Link href="/messages" className="bg-card border border-border p-4 rounded-2xl shadow-sm hover:border-primary/50 transition-colors group block">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                <MessageSquare className="h-5 w-5" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground font-medium">Unread Messages</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{unreadMessages}</p>
          </Link>

          <Link href="/billing" className="bg-card border border-border p-4 rounded-2xl shadow-sm hover:border-primary/50 transition-colors group block">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CreditCard className="h-5 w-5" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground font-medium">Pending Bills</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{formatMoney(pendingAmount)}</p>
          </Link>

          <Link href="/records" className="bg-card border border-border p-4 rounded-2xl shadow-sm hover:border-primary/50 transition-colors group block">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Activity className="h-5 w-5" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground font-medium">Active Rx</p>
            <p className="text-lg font-bold text-foreground mt-0.5">2 Medications</p>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upcoming Appointments List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Upcoming Appointments</h3>
              <Link href="/appointments" className="text-sm font-medium text-primary flex items-center gap-1 hover:underline">
                View all <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            
            <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
              {upcomingAppointments.length > 0 ? (
                <div className="divide-y divide-border">
                  {upcomingAppointments.slice(0, 3).map(apt => (
                    <div key={apt.id} className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between hover:bg-muted/50 transition-colors">
                      <div className="flex gap-4 items-start">
                        <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 text-center min-w-[70px]">
                          <div className="text-xs font-semibold text-primary uppercase tracking-wider">{apt.date.split(' ')[0]}</div>
                          <div className="text-xl font-bold text-foreground leading-tight">{apt.date.split(' ')[1].replace(',', '')}</div>
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground">{apt.doctor.name}</h4>
                          <p className="text-sm text-muted-foreground">{apt.doctor.specialty} • {apt.doctor.clinic}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground">{apt.time}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ml-2 ${getStatusColor(apt.status)}`}>
                              {apt.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
                  <p className="text-muted-foreground">No upcoming appointments</p>
                </div>
              )}
            </div>
          </div>

          {/* Activity Feed */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Recent Activity</h3>
            <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
              <div className="space-y-6">
                {activities.map((activity, i) => (
                  <div key={activity.id} className="relative flex gap-4">
                    {i !== activities.length - 1 && (
                      <div className="absolute left-4 top-8 bottom-[-24px] w-px bg-border"></div>
                    )}
                    <div className="relative z-10 h-8 w-8 rounded-full bg-background border-2 border-border flex items-center justify-center shrink-0">
                      <div className="h-2 w-2 rounded-full bg-primary/40"></div>
                    </div>
                    <div className="pt-1.5 pb-1">
                      <p className="text-sm font-medium text-foreground leading-snug">{activity.text}</p>
                      <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
