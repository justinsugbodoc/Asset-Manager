import { createContext, useContext, useState } from 'react';

// Canonical localStorage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'sugbodoc_auth_token',
  CURRENT_USER: 'sugbodoc_current_user',
  USERS: 'sugbodoc_users',
  APPOINTMENTS: 'sugbodoc_appointments',
} as const;

type AuthContextType = {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
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
