import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, clearAuth, getToken, setToken } from '../../services/api';

const AuthContext = createContext(null);

const withRoles = (res) => ({ ...res.user, roles: res.roles ?? [] });

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(() => !!getToken());
  // Set when the saved session couldn't be checked (server down, network error)
  const [restoreError, setRestoreError] = useState(null);

  // Restore the session from a saved token. Only a 401 ends the session (api.js
  // clears the token); a network error or aborted request keeps it, so a refresh
  // or a server hiccup never logs anyone out — the app offers "Retry" instead.
  const loadMe = useCallback((isActive = () => true) =>
    api.me()
      .then((res) => isActive() && setUser(withRoles(res)))
      .catch((err) => isActive() && getToken() && err.name !== 'AbortError' && setRestoreError(err))
      .finally(() => isActive() && setChecking(false)), []);

  useEffect(() => {
    if (!getToken()) return;
    let active = true;
    loadMe(() => active);
    return () => { active = false; };
  }, [loadMe]);

  const retryRestore = useCallback(() => {
    setRestoreError(null);
    setChecking(true);
    loadMe();
  }, [loadMe]);

  // Session expired (401 from the API): drop the user and cached data
  useEffect(() => {
    const handler = () => {
      setUser(null);
      queryClient.clear();
    };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, [queryClient]);

  const login = useCallback(async (email, password) => {
    const res = await api.login(email, password);
    setToken(res.token);
    setUser(withRoles(res));
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* token may already be gone */ }
    clearAuth();
    queryClient.clear();
    setRestoreError(null);
    setUser(null);
  }, [queryClient]);

  const value = useMemo(
    () => ({ user, checking, restoreError, retryRestore, login, logout }),
    [user, checking, restoreError, retryRestore, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
