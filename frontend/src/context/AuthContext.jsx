import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);
const TOKEN_KEY = 'js_token';
const USER_KEY  = 'js_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  const persist = useCallback((nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
    if (nextToken) localStorage.setItem(TOKEN_KEY, nextToken);
    else localStorage.removeItem(TOKEN_KEY);
    if (nextUser) localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    else localStorage.removeItem(USER_KEY);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      const stored = localStorage.getItem(TOKEN_KEY);
      if (!stored) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        if (!cancelled) persist(stored, data.user);
      } catch {
        if (!cancelled) persist(null, null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    restore();
    return () => {
      cancelled = true;
    };
  }, [persist]);

  const login = useCallback(
    async (credentials, portal) => {
      const { data } = await api.post('/auth/login', credentials);
      const role = data.user?.role;
      const isAuthority = role === 'sub-admin' || role === 'super-admin';

      if (portal === 'citizen' && isAuthority) {
        throw new Error('This account is an authority login. Switch to the Authority tab.');
      }
      if (portal === 'authority' && !isAuthority) {
        throw new Error('This account is a citizen login. Switch to the Citizen tab.');
      }

      persist(data.token, data.user);
      return data.user;
    },
    [persist]
  );

  const register = useCallback(
    async (payload) => {
      const { data } = await api.post('/auth/register', payload);
      persist(data.token, data.user);
      return data.user;
    },
    [persist]
  );

  const googleLogin = useCallback(
    async (credential) => {
      const { data } = await api.post('/auth/google', { credential });
      persist(data.token, data.user);
      return data.user;
    },
    [persist]
  );

  // Sync cached user after profile edits without re-fetching the token
  const updateUser = useCallback(
    (updatedUser) => {
      setUser(updatedUser);
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.clear();
    sessionStorage.clear();
    setUser(null);
    window.location.href = '/login';
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, register, googleLogin, updateUser, logout }),
    [user, token, loading, login, register, googleLogin, updateUser, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
