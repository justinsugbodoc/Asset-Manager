import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoading(true);
    // Simulate network delay
    setTimeout(() => {
      login('mock-jwt-token');
      setLocation('/');
    }, 1200);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-slate-50 dark:bg-background p-4 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="w-full max-w-[400px] bg-card rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-border p-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary tracking-tight">SugboDoc</h1>
          <p className="text-sm text-muted-foreground mt-2">Your lifelong digital health record</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juan@example.com"
              className="w-full h-11 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              required
            />
          </div>
          
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground" htmlFor="password">Password</label>
              <a href="#" className="text-xs text-primary font-medium hover:underline">Forgot password?</a>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-11 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              required
            />
          </div>

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
            Don't have an account? <a href="#" className="text-primary font-medium hover:underline">Register</a>
          </p>
        </div>
      </div>
    </div>
  );
}
