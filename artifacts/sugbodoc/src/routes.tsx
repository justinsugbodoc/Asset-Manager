import { useEffect } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { getCurrentSessionUser, useAuth } from '@/hooks/use-auth';

// Pages
import Dashboard from '@/pages/dashboard';
import Login from '@/pages/login';
import Register from '@/pages/register';
import Appointments from '@/pages/appointments';
import Records from '@/pages/records';
import Messages from '@/pages/messages';
import Billing from '@/pages/billing';
import Medications from '@/pages/medications';
import Profile from '@/pages/profile';
import InsuranceClaims from '@/pages/insurance-claims';
import NotFound from '@/pages/not-found';
import Admin from '@/pages/admin';
import Doctor from '@/pages/doctor';

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { token } = useAuth();
  const [, setLocation] = useLocation();
  const user = getCurrentSessionUser();
  const isStaff = user?.role === 'Admin' || user?.role === 'Clinician';
  const isDoctor = user?.role === 'Doctor';

  useEffect(() => {
    if (!token) {
      setLocation('/login');
    } else if (isStaff) {
      setLocation('/admin');
    } else if (isDoctor) {
      setLocation('/doctor');
    }
  }, [token, isStaff, isDoctor, setLocation]);

  if (!token) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Opening sign in…</p>
        </div>
      </div>
    );
  }

  if (isStaff || isDoctor) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Opening your clinical workspace…</p>
        </div>
      </div>
    );
  }

  return <Component {...rest} />;
}

function DoctorRoute() {
  const { token } = useAuth();
  const [, setLocation] = useLocation();
  const user = getCurrentSessionUser();

  useEffect(() => {
    if (!token) setLocation('/login');
    else if (user?.role !== 'Doctor') setLocation(user?.role === 'Admin' || user?.role === 'Clinician' ? '/admin' : '/');
  }, [token, user?.role, setLocation]);

  if (!token || user?.role !== 'Doctor') return null;
  return <Doctor />;
}

function AdminRoute() {
  const { token } = useAuth();
  const [, setLocation] = useLocation();
  const user = getCurrentSessionUser();

  useEffect(() => {
    if (!token) setLocation('/login');
    else if (user?.role !== 'Admin' && user?.role !== 'Clinician') setLocation('/');
  }, [token, user?.role, setLocation]);

  if (!token) return null;
  if (user?.role !== 'Admin' && user?.role !== 'Clinician') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-background">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">This workspace is limited to authorized SugboDoc administrators.</p>
          <button onClick={() => setLocation('/')} className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Return to portal</button>
        </div>
      </div>
    );
  }
  return <Admin />;
}

export function AppRoutes() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/appointments">
        {() => <ProtectedRoute component={Appointments} />}
      </Route>
      <Route path="/records">
        {() => <ProtectedRoute component={Records} />}
      </Route>
      <Route path="/messages">
        {() => <ProtectedRoute component={Messages} />}
      </Route>
      <Route path="/billing">
        {() => <ProtectedRoute component={Billing} />}
      </Route>
      <Route path="/medications">
        {() => <ProtectedRoute component={Medications} />}
      </Route>
      <Route path="/profile">
        {() => <ProtectedRoute component={Profile} />}
      </Route>
      <Route path="/insurance-claims">
        {() => <ProtectedRoute component={InsuranceClaims} />}
      </Route>
      <Route path="/admin">
        {() => <AdminRoute />}
      </Route>
      <Route path="/doctor">
        {() => <DoctorRoute />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}
