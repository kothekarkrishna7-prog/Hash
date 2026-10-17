import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  // Check existing session on application load
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
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
      return { success: true };
    } catch (err) {
      setAuthError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch {
      // Ignore network errors on logout
    } finally {
      setUser(null);
    }
  };

  // Update Profile Name
  const updateProfile = async (name) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
        loading,
        authError,
        setAuthError,
        login,
        register,
        logout,
        updateProfile,
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
