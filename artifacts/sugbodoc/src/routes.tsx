import { useEffect } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';

// Pages
import Dashboard from '@/pages/dashboard';
import Login from '@/pages/login';
import Appointments from '@/pages/appointments';
import Records from '@/pages/records';
import Messages from '@/pages/messages';
import Billing from '@/pages/billing';
import Profile from '@/pages/profile';
import NotFound from '@/pages/not-found';

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { token } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!token) {
      setLocation('/login');
    }
  }, [token, setLocation]);

  if (!token) return null;

  return <Component {...rest} />;
}

export function AppRoutes() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
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
      <Route path="/profile">
        {() => <ProtectedRoute component={Profile} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}
