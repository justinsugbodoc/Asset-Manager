import { createContext, useContext, useState, useEffect } from 'react';

type AuthContextType = {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('sugbodoc_token'));

  const login = (newToken: string) => {
    localStorage.setItem('sugbodoc_token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('sugbodoc_token');
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
