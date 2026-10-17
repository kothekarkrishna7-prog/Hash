import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export const AuthContext = createContext(null);

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('sentinel_token') || '');
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  // Check existing session on application load
  const checkSession = useCallback(async () => {
    try {
      const storedToken = localStorage.getItem('sentinel_token') || '';
      const headers = {};
      if (storedToken) {
        headers['Authorization'] = `Bearer ${storedToken}`;
      }

      const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers,
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        const activeToken = data.token || storedToken;
        if (activeToken) {
          localStorage.setItem('sentinel_token', activeToken);
          setToken(activeToken);
        }
      } else {
        setUser(null);
        localStorage.removeItem('sentinel_token');
        setToken('');
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Authenticated fetch wrapper (combines HttpOnly Cookie + Bearer token)
  const authFetch = useCallback(
    (url, options = {}) => {
      const headers = { ...(options.headers || {}) };
      const currentToken = localStorage.getItem('sentinel_token') || token;
      if (currentToken && !headers['Authorization'] && !headers['authorization']) {
        headers['Authorization'] = `Bearer ${currentToken}`;
      }
      return fetch(url, {
        ...options,
        credentials: 'include',
        headers
      });
    },
    [token]
  );

  // Register
  const register = async (name, email, password, confirmPassword) => {
    setAuthError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password, confirmPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Registration failed.');
      }

      setUser(data.user);
      if (data.token) {
        localStorage.setItem('sentinel_token', data.token);
        setToken(data.token);
      }
      return { success: true };
    } catch (err) {
      setAuthError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Login
  const login = async (email, password) => {
    setAuthError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Login failed.');
      }

      setUser(data.user);
      if (data.token) {
        localStorage.setItem('sentinel_token', data.token);
        setToken(data.token);
      }
      return { success: true };
    } catch (err) {
      setAuthError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Logout
  const logout = async () => {
    try {
      const storedToken = localStorage.getItem('sentinel_token') || token;
      const headers = {};
      if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;
      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        method: 'POST',
        headers,
        credentials: 'include'
      });
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('sentinel_token');
      setToken('');
      setUser(null);
    }
  };

  // Update Profile Name
  const updateProfile = async (name) => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/user/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to update profile.');
      }
      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        authError,
        setAuthError,
        login,
        register,
        logout,
        updateProfile,
        authFetch,
        refreshSession: checkSession,
        isAuthenticated: Boolean(user),
        backendUrl: BACKEND_URL
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
