import { createContext, useContext, useState } from 'react';

// Canonical localStorage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'sugbodoc_auth_token',
  CURRENT_USER: 'sugbodoc_current_user',
  USERS: 'sugbodoc_users',
  APPOINTMENTS: 'sugbodoc_appointments',
} as const;

export type UserRole = 'Patient' | 'Admin' | 'Clinician';

export type SessionUser = {
  id?: string;
  name: string;
  initials: string;
  email: string;
  phone?: string;
  birthday?: string;
  gender?: string;
  bloodType?: string;
  role?: UserRole;
  status?: 'Active' | 'Inactive';
  clinicalEditingPermission?: boolean;
  insurance?: Record<string, unknown> | null;
  claims?: Record<string, unknown>[];
};

export function getCurrentSessionUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function ensureDemoAdmin() {
  try {
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) ?? '[]') as Array<SessionUser & { password?: string }>;
    if (users.some(user => user.email.toLowerCase() === 'admin@sugbodoc.test')) return;
    users.push({
      name: 'SugboDoc Administrator',
      initials: 'SA',
      email: 'admin@sugbodoc.test',
      password: 'admin123',
      phone: '+63 900 000 0000',
      birthday: '1988-01-01',
      gender: 'Prefer not to say',
      bloodType: '',
      role: 'Admin',
      status: 'Active',
      clinicalEditingPermission: false,
    });
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  } catch {
    // Demo seed is best-effort.
  }
}

type AuthContextType = {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  ensureDemoAdmin();
  const [token, setToken] = useState<string | null>(
    localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN),
  );

  const login = (newToken: string) => {
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, newToken);
    setToken(newToken);
  };

  // Only clears session — does NOT touch sugbodoc_users or sugbodoc_appointments
  const logout = () => {
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
