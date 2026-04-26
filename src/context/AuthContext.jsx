import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const BEHAVE_TOKEN_KEY = 'beagleTokenBeforeBehave';
const BEHAVE_USER_KEY = 'beagleUserBeforeBehave';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  /** When set, UI is viewing as another user (read-only API enforced server-side). */
  const [behaveAs, setBehaveAs] = useState(null);

  const refreshUser = useCallback(async () => {
    const storedToken = localStorage.getItem('authToken');
    if (!storedToken) return;
    try {
      const { data } = await authAPI.getMe();
      if (data?.user) {
        setUser(data.user);
        localStorage.setItem('authUser', JSON.stringify(data.user));
        setBehaveAs(data.behaveAs?.active ? data.behaveAs : null);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('authUser');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      authAPI
        .getMe()
        .then(({ data }) => {
          if (data?.user) {
            setUser(data.user);
            localStorage.setItem('authUser', JSON.stringify(data.user));
            setBehaveAs(data.behaveAs?.active ? data.behaveAs : null);
          }
        })
        .catch(() => {});
    }

    setLoading(false);
  }, []);

  const login = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('authToken', newToken);
    localStorage.setItem('authUser', JSON.stringify(newUser));
    setBehaveAs(null);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setBehaveAs(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    sessionStorage.removeItem(BEHAVE_TOKEN_KEY);
    sessionStorage.removeItem(BEHAVE_USER_KEY);
  };

  const enterBehaveAs = async (targetUserId) => {
    const currentToken = localStorage.getItem('authToken');
    const currentUser = localStorage.getItem('authUser');
    if (!currentToken || !currentUser) return;
    const { data } = await authAPI.behaveAs(targetUserId);
    sessionStorage.setItem(BEHAVE_TOKEN_KEY, currentToken);
    sessionStorage.setItem(BEHAVE_USER_KEY, currentUser);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('authUser', JSON.stringify(data.user));
    setBehaveAs(data.behaveAs || { active: true, originalName: '' });
  };

  const exitBehaveAs = () => {
    const prevT = sessionStorage.getItem(BEHAVE_TOKEN_KEY);
    const prevU = sessionStorage.getItem(BEHAVE_USER_KEY);
    sessionStorage.removeItem(BEHAVE_TOKEN_KEY);
    sessionStorage.removeItem(BEHAVE_USER_KEY);
    if (prevT && prevU) {
      setToken(prevT);
      setUser(JSON.parse(prevU));
      localStorage.setItem('authToken', prevT);
      localStorage.setItem('authUser', prevU);
    }
    setBehaveAs(null);
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!token,
    behaveAs,
    enterBehaveAs,
    exitBehaveAs,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
