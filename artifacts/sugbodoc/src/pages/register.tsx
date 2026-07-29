import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useAuth, STORAGE_KEYS } from '@/hooks/use-auth';
import { Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import Logo from '@/components/brand/logo';

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

type StoredUser = {
  name: string;
  initials: string;
  email: string;
  password: string;
  phone: string;
  birthday: string;
  gender: string;
  bloodType: string;
};

function Field({ id, label, children }: { id?: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full h-11 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm';

export default function Register() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    birthday: '',
    gender: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError('');
  };

  const validate = (): string => {
    if (!form.fullName.trim()) return 'Full name is required.';
    if (!form.email.trim()) return 'Email address is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Please enter a valid email address.';
    if (!form.phone.trim()) return 'Phone number is required.';
    if (!form.birthday) return 'Birthday is required.';
    if (!form.gender) return 'Please select a gender.';
    if (form.password.length < 8) return 'Password must be at least 8 characters.';
    if (form.password !== form.confirmPassword) return 'Passwords do not match.';
    return '';
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    const existing: StoredUser[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) ?? '[]');
    if (existing.some((u) => u.email.toLowerCase() === form.email.toLowerCase())) {
      setError('An account with this email already exists.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      const parts = form.fullName.trim().split(/\s+/);
      const initials =
        parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : form.fullName.slice(0, 2).toUpperCase();

      const newUser: StoredUser = {
        name: form.fullName.trim(),
        initials,
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
        birthday: form.birthday,
        gender: form.gender,
        bloodType: '',
      };

      // Save full user list (includes password for login lookup)
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([...existing, newUser]));

      // Save session user without password
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _pw, ...sessionUser } = newUser;
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(sessionUser));

      setSuccess(true);
      setTimeout(() => {
        login('sugbodoc-auth-token');
        setLocation('/');
      }, 1200);
    }, 900);
  };

  const isFormValid = Object.values(form).every((v) => v.trim().length > 0);

  if (success) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-slate-50 dark:bg-background p-4">
        <div className="w-full max-w-[400px] bg-card rounded-2xl shadow-xl border border-border p-10 text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="h-14 w-14 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Account Created!</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Welcome to SugboDoc,{' '}
            <span className="font-semibold text-foreground">{form.fullName.trim().split(' ')[0]}</span>!
            Redirecting you to your dashboard…
          </p>
          <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto mt-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-slate-50 dark:bg-background p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="w-full max-w-[440px] bg-card rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-border p-8 relative z-10 my-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-8">
          <Logo className="justify-center" />
          <p className="text-sm text-muted-foreground mt-2">Create your patient account</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4" noValidate>

          {/* Full Name */}
          <Field id="fullName" label="Full Name">
            <input
              id="fullName"
              type="text"
              value={form.fullName}
              onChange={set('fullName')}
              placeholder="Juan dela Cruz"
              autoComplete="name"
              className={inputCls}
            />
          </Field>

          {/* Email */}
          <Field id="email" label="Email Address">
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="juan@example.com"
              autoComplete="email"
              className={inputCls}
            />
          </Field>

          {/* Phone */}
          <Field id="phone" label="Phone Number">
            <input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              placeholder="+63 912 345 6789"
              autoComplete="tel"
              className={inputCls}
            />
          </Field>

          {/* Birthday + Gender */}
          <div className="grid grid-cols-2 gap-3">
            <Field id="birthday" label="Birthday">
              <input
                id="birthday"
                type="date"
                value={form.birthday}
                onChange={set('birthday')}
                max={new Date().toISOString().split('T')[0]}
                className={inputCls}
              />
            </Field>
            <Field id="gender" label="Gender">
              <select
                id="gender"
                value={form.gender}
                onChange={set('gender')}
                className={`${inputCls} text-sm`}
              >
                <option value="">Select…</option>
                {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
          </div>

          {/* Password */}
          <Field id="password" label="Password">
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={set('password')}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
                className={`${inputCls} pr-10`}
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          {/* Confirm Password */}
          <Field id="confirmPassword" label="Confirm Password">
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                className={`${inputCls} pr-10`}
              />
              <button type="button" onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !isFormValid}
            className="w-full h-11 bg-primary text-primary-foreground rounded-lg font-medium text-sm transition-all hover:bg-primary/90 focus:ring-4 focus:ring-primary/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center shadow-sm mt-2"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary font-medium hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
