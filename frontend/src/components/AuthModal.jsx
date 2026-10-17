import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }) {
  const { login, register, authError, setAuthError } = useAuth();
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // States
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  if (!isOpen) return null;

  const validate = () => {
    const errors = {};
    if (mode === 'register') {
      if (!name.trim()) errors.name = 'Name is required.';
      else if (name.trim().length < 2) errors.name = 'Name must be at least 2 characters.';
    }

    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    }

    if (mode === 'register' && password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setAuthError('');

    if (mode === 'login') {
      const res = await login(email, password);
      setSubmitting(false);
      if (res.success) {
        onClose?.();
      }
    } else {
      const res = await register(name, email, password, confirmPassword);
      setSubmitting(false);
      if (res.success) {
        onClose?.();
      }
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setFieldErrors({});
    setAuthError('');
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div className="brand-logo" style={{ width: '32px', height: '32px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                {mode === 'login' ? 'Sign in to API Sentinel' : 'Create an Account'}
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {mode === 'login'
                  ? 'Access your saved API test history and profile metrics'
                  : 'Start tracking test history and automated assertion reports'}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              className="btn-close-modal"
              onClick={onClose}
              aria-label="Close modal"
            >
              ✕
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="tab-row" style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
          <button
            type="button"
            className={`tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => switchMode('login')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`tab-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => switchMode('register')}
          >
            Register
          </button>
        </div>

        {/* Global Error Banner */}
        {authError && (
          <div className="auth-alert error" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-name">
                Full Name
              </label>
              <input
                id="auth-name"
                type="text"
                className={`form-input ${fieldErrors.name ? 'error' : ''}`}
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                disabled={submitting}
              />
              {fieldErrors.name && <span className="inline-error">{fieldErrors.name}</span>}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="auth-email">
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              className={`form-input ${fieldErrors.email ? 'error' : ''}`}
              placeholder="jane@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={submitting}
            />
            {fieldErrors.email && <span className="inline-error">{fieldErrors.email}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="auth-password">
              Password
            </label>
            <div className="password-input-wrapper">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                className={`form-input ${fieldErrors.password ? 'error' : ''}`}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                disabled={submitting}
              />
              <button
                type="button"
                className="btn-toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {fieldErrors.password && <span className="inline-error">{fieldErrors.password}</span>}
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-confirm-password">
                Confirm Password
              </label>
              <div className="password-input-wrapper">
                <input
                  id="auth-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className={`form-input ${fieldErrors.confirmPassword ? 'error' : ''}`}
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="btn-toggle-password"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <span className="inline-error">{fieldErrors.confirmPassword}</span>
              )}
            </div>
          )}

          <button
            type="submit"
            className="btn-send"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    border: '2px solid rgba(8,12,20,0.3)',
                    borderTopColor: '#080C14',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite'
                  }}
                />
                Processing...
              </>
            ) : mode === 'login' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => switchMode('register')}
              >
                Register here
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => switchMode('login')}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
