/**
 * context/AuthContext.jsx
 * Global auth state: user, token, login/logout helpers.
 */

import { createContext, useContext, useState, useCallback } from 'react';
import { authApi } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('tht_user')); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('tht_token') || null);

  const saveSession = useCallback((data) => {
    localStorage.setItem('tht_token', data.token);
    localStorage.setItem('tht_user',  JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('tht_token');
    localStorage.removeItem('tht_user');
    setToken(null);
    setUser(null);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authApi.login({ email, password });
    saveSession(data);
    return data;
  }, [saveSession]);

  const register = useCallback(async (username, email, password) => {
    const data = await authApi.register({ username, email, password });
    saveSession(data);
    return data;
  }, [saveSession]);

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoggedIn: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
