import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useAuth, STORAGE_KEYS } from '@/hooks/use-auth';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import Logo from '@/components/brand/logo';
import { serverLogin } from '@/lib/server';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    setLoading(true);
    try {
      const result = await serverLogin(email, password);
      sessionStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(result.user));
      login(result.token);
       setLocation(result.user.role === 'Admin' || result.user.role === 'Clinician' ? '/admin' : result.user.role === 'Doctor' ? '/doctor' : '/');
      return;
    } catch (error) {
      setLoading(false);
      setError(error instanceof Error ? error.message : 'Unable to sign in right now.');
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-slate-50 dark:bg-background p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="w-full max-w-[400px] bg-card rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-border p-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-8">
          <Logo className="justify-center" />
          <p className="text-sm text-muted-foreground mt-2">Your lifelong digital health record</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="juan@example.com"
              autoComplete="email"
              className="w-full h-11 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              required
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground" htmlFor="password">Password</label>
              <a href="#" className="text-xs text-primary font-medium hover:underline">Forgot password?</a>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full h-11 px-3 pr-10 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full h-11 bg-primary text-primary-foreground rounded-lg font-medium text-sm transition-all hover:bg-primary/90 focus:ring-4 focus:ring-primary/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center shadow-sm"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link href="/register" className="text-primary font-medium hover:underline">
              Register
            </Link>
          </p>
        </div>
         <div className="mt-5 space-y-2 rounded-xl border border-primary/15 bg-primary/5 p-3 text-center text-xs text-muted-foreground">
           <p>Admin demo: <span className="font-semibold text-foreground">admin@sugbodoc.test</span> · password <span className="font-semibold text-foreground">admin123</span></p>
           <p>Doctor demo: <span className="font-semibold text-foreground">doctor@sugbodoc.test</span> · password <span className="font-semibold text-foreground">doctor123</span></p>
        </div>
      </div>
    </div>
  );
}
