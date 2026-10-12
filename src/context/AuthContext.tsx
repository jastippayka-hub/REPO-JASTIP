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

  // Helper to parse responses safely and handle HTML / proxy errors
  const parseApiResponse = async <T = any,>(
    res: Response,
    fallbackErrMsg: string
  ): Promise<{ ok: boolean; status: number; data?: T; error?: string }> => {
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      try {
        const data = await res.json();
        if (!res.ok) {
          return {
            ok: false,
            status: res.status,
            error: data?.error || `${fallbackErrMsg} (Status ${res.status})`,
          };
        }
        return { ok: true, status: res.status, data };
      } catch {
        return {
          ok: false,
          status: res.status,
          error: `${fallbackErrMsg}: Format respons JSON tidak valid dari server.`,
        };
      }
    }

    // Response is not JSON (e.g. HTML 404, 502 Bad Gateway, or proxy fallback)
    const text = await res.text().catch(() => '');
    let diagnosticMsg = `${fallbackErrMsg} (Status ${res.status})`;

    if (text.includes('<!DOCTYPE') || text.includes('<html') || text.trim().startsWith('<')) {
      if (res.status === 404) {
        diagnosticMsg = 'Layanan API tidak ditemukan pada server deployment (404). Pastikan backend Express aktif.';
      } else if (res.status === 502 || res.status === 503 || res.status === 504) {
        diagnosticMsg = `Server deployment sedang tidak siap atau tidak dapat dijangkau (${res.status}). Silakan coba beberapa saat lagi.`;
      } else {
        diagnosticMsg = `Server mengembalikan halaman web HTML alih-alih data API (Status ${res.status}).`;
      }
    } else if (text.trim().length > 0 && text.trim().length < 160) {
      diagnosticMsg = text.trim();
    }

    return {
      ok: false,
      status: res.status,
      error: diagnosticMsg,
    };
  };

  // Authenticated fetch helper with network resilience
  const authFetch = async (url: string, options: RequestInit = {}) => {
    try {
      const headers = new Headers(options.headers || {});
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return await fetch(url, { ...options, headers });
    } catch (err: any) {
      console.warn(`[authFetch] Network connection issue for ${url}:`, err?.message || err);
      // Return a synthesized Response so caller doesn't crash with unhandled TypeError: Failed to fetch
      return new Response(JSON.stringify({ error: 'Jaringan atau server sedang tidak dapat dijangkau' }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await authFetch('/api/auth/me');
      const parsed = await parseApiResponse<{ user: User }>(res, 'Gagal memuat sesi');
      if (parsed.ok && parsed.data?.user) {
        setCurrentUser(parsed.data.user);
        localStorage.setItem('payka_user', JSON.stringify(parsed.data.user));
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
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const parsed = await parseApiResponse<{ user: User; token: string }>(res, 'Login gagal');
      if (!parsed.ok || !parsed.data) {
        return { success: false, error: parsed.error || 'Login gagal.' };
      }

      const { user, token: authToken } = parsed.data;
      if (!user || !authToken) {
        return { success: false, error: 'Data sesi login tidak lengkap dari server.' };
      }

      setCurrentUser(user);
      setToken(authToken);
      localStorage.setItem('payka_user', JSON.stringify(user));
      localStorage.setItem('payka_token', authToken);

      return { success: true };
    } catch (err: any) {
      const msg = err?.message || 'Gagal terhubung ke server.';
      const friendly = msg.includes('Failed to fetch')
        ? 'Gagal terhubung ke server backend. Pastikan server aktif dan periksa koneksi internet.'
        : msg;
      return { success: false, error: friendly };
    }
  };

  const register = async (payload: any) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const parsed = await parseApiResponse<{ user: User; token: string }>(res, 'Pendaftaran gagal');
      if (!parsed.ok || !parsed.data) {
        return { success: false, error: parsed.error || 'Pendaftaran gagal.' };
      }

      const { user, token: authToken } = parsed.data;
      setCurrentUser(user);
      setToken(authToken);
      localStorage.setItem('payka_user', JSON.stringify(user));
      localStorage.setItem('payka_token', authToken);

      return { success: true };
    } catch (err: any) {
      const msg = err?.message || 'Gagal mendaftar.';
      const friendly = msg.includes('Failed to fetch')
        ? 'Gagal terhubung ke server backend. Pastikan server aktif dan periksa koneksi internet.'
        : msg;
      return { success: false, error: friendly };
    }
  };

  const continueAsGuest = async (guestName?: string, guestPhone?: string, guestAddress?: string) => {
    try {
      const res = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ name: guestName, phone: guestPhone, address: guestAddress }),
      });

      const parsed = await parseApiResponse<{ user: User; token: string }>(res, 'Gagal masuk sebagai tamu');
      if (!parsed.ok || !parsed.data) {
        return { success: false, error: parsed.error || 'Gagal masuk sebagai tamu.' };
      }

      const { user, token: authToken } = parsed.data;
      setCurrentUser(user);
      setToken(authToken);
      localStorage.setItem('payka_user', JSON.stringify(user));
      localStorage.setItem('payka_token', authToken);
      return { success: true };
    } catch (err: any) {
      const msg = err?.message || 'Gagal terhubung ke server.';
      const friendly = msg.includes('Failed to fetch')
        ? 'Gagal terhubung ke server backend. Pastikan server aktif dan periksa koneksi internet.'
        : msg;
      return { success: false, error: friendly };
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
