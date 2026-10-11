import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types/index.js';

interface AuthContextType {
  currentUser: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (payload: any) => Promise<{ success: boolean; error?: string }>;
  continueAsGuest: (guestName?: string, guestPhone?: string, guestAddress?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateWalletBalance: (newBalance: number) => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('payka_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('payka_token') || null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const updateWalletBalance = (newBalance: number) => {
    if (currentUser) {
      const updated = { ...currentUser, walletBalance: newBalance };
      setCurrentUser(updated);
      localStorage.setItem('payka_user', JSON.stringify(updated));
    }
  };

  // Authenticated fetch helper
  const authFetch = async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(url, { ...options, headers });
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await authFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        localStorage.setItem('payka_user', JSON.stringify(data.user));
      } else if (res.status === 401) {
        logout();
      }
    } catch (err) {
      console.error('Failed refreshing user data', err);
    }
  };

  useEffect(() => {
    if (token) {
      refreshUser().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Login gagal.' };
      }

      setCurrentUser(data.user);
      setToken(data.token);
      localStorage.setItem('payka_user', JSON.stringify(data.user));
      localStorage.setItem('payka_token', data.token);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal terhubung ke server.' };
    }
  };

  const register = async (payload: any) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Pendaftaran gagal.' };
      }

      setCurrentUser(data.user);
      setToken(data.token);
      localStorage.setItem('payka_user', JSON.stringify(data.user));
      localStorage.setItem('payka_token', data.token);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal mendaftar.' };
    }
  };

  const continueAsGuest = async (guestName?: string, guestPhone?: string, guestAddress?: string) => {
    try {
      const res = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: guestName, phone: guestPhone, address: guestAddress }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Gagal masuk sebagai tamu.' };
      }
      setCurrentUser(data.user);
      setToken(data.token);
      localStorage.setItem('payka_user', JSON.stringify(data.user));
      localStorage.setItem('payka_token', data.token);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal terhubung ke server.' };
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setToken(null);
    localStorage.removeItem('payka_user');
    localStorage.removeItem('payka_token');
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        isLoading,
        login,
        register,
        continueAsGuest,
        logout,
        refreshUser,
        updateWalletBalance,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
