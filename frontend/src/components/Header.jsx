import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const PRESETS = [
  {
    id: 'get-user-success',
    label: 'Preset 1: GET User Profile (200 OK + JSON)',
    url: 'https://jsonplaceholder.typicode.com/users/1',
    method: 'GET',
    headers: [{ key: 'Accept', value: 'application/json' }],
    body: '',
    expectedStatus: 200,
    requireValidJson: true,
    requiredFields: ['id', 'name', 'username', 'email'],
    maxTimeMs: 2500
  },
  {
    id: 'get-post-success',
    label: 'Preset 2: GET Post (200 OK + JSON)',
    url: 'https://jsonplaceholder.typicode.com/posts/1',
    method: 'GET',
    headers: [{ key: 'Accept', value: 'application/json' }],
    body: '',
    expectedStatus: 200,
    requireValidJson: true,
    requiredFields: ['id', 'title', 'userId'],
    maxTimeMs: 2000
  },
  {
    id: 'post-create-item',
    label: 'Preset 3: POST Create Item (201 Created)',
    url: 'https://jsonplaceholder.typicode.com/posts',
    method: 'POST',
    headers: [
      { key: 'Content-Type', value: 'application/json' },
      { key: 'Accept', value: 'application/json' }
    ],
    body: JSON.stringify(
      {
        title: 'API Sentinel Automated Test',
        body: 'Testing outbound POST execution and assertions.',
        userId: 42
      },
      null,
      2
    ),
    expectedStatus: 201,
    requireValidJson: true,
    requiredFields: ['id', 'title'],
    maxTimeMs: 3000
  },
  {
    id: 'get-404-check',
    label: 'Preset 4: GET 404 Endpoint Validation',
    url: 'https://jsonplaceholder.typicode.com/posts/999999',
    method: 'GET',
    headers: [],
    body: '',
    expectedStatus: 404,
    requireValidJson: false,
    requiredFields: [],
    maxTimeMs: 2500
  },
  {
    id: 'blocked-ssrf-demo',
    label: 'Preset 5: Security Demo (Blocked AWS Metadata)',
    url: 'http://169.254.169.254/latest/meta-data',
    method: 'GET',
    headers: [],
    body: '',
    expectedStatus: 200,
    requireValidJson: false,
    requiredFields: [],
    maxTimeMs: null
  }
];

export default function Header({
  backendUrl,
  activeTab,
  setActiveTab,
  onOpenAuthModal,
  onSelectPreset,
  onReset
}) {
  const { user, logout, isAuthenticated } = useAuth();
  const [backendStatus, setBackendStatus] = useState('checking'); // 'online' | 'offline' | 'checking'

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          setBackendStatus('online');
        } else {
          setBackendStatus('offline');
        }
      } catch {
        setBackendStatus('offline');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [backendUrl]);

  const [theme, setTheme] = useState(() => {
    try {
      return (
        localStorage.getItem('sentinel_theme') ||
        (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      );
    } catch {
      return 'dark';
    }
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    try {
      localStorage.setItem('sentinel_theme', nextTheme);
    } catch {}
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const userInitials = (user?.name || 'U')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="app-header-container">
      <div className="app-header">
        <div className="brand-section">
          <div
            className="brand-logo"
            aria-hidden="true"
            onClick={() => setActiveTab('dashboard')}
            style={{ cursor: 'pointer' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(8,12,20,0.4)" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div className="brand-text">
            <h1 onClick={() => setActiveTab('dashboard')} style={{ cursor: 'pointer' }}>
              API Sentinel
              <span className="brand-badge">PRO v1.2</span>
            </h1>
            <p>Developer API Testing, Assertion Engine & History Dashboard</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="header-nav" aria-label="Main Navigation">
          <button
            type="button"
            className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Dashboard
          </button>

          <button
            type="button"
            className={`nav-link ${activeTab === 'tester' ? 'active' : ''}`}
            onClick={() => setActiveTab('tester')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            API Tester
          </button>

          <button
            type="button"
            className={`nav-link ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => {
              if (!isAuthenticated) {
                onOpenAuthModal?.('login');
              } else {
                setActiveTab('history');
              }
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            History
          </button>

          <button
            type="button"
            className={`nav-link ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => {
              if (!isAuthenticated) {
                onOpenAuthModal?.('login');
              } else {
                setActiveTab('profile');
              }
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Profile
          </button>
        </nav>

        {/* User Auth & Health Status */}
        <div className="header-actions">
          {/* Light / Dark Mode Toggle */}
          <button
            id="theme-toggle"
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          <div
            className="backend-status-pill"
            title={`Backend health check endpoint: ${backendUrl}/health`}
          >
            <span className={`status-dot ${backendStatus}`}></span>
            <span>
              {backendStatus === 'online'
                ? 'Backend: Online'
                : backendStatus === 'offline'
                ? 'Backend: Disconnected'
                : 'Connecting...'}
            </span>
          </div>

          {isAuthenticated ? (
            <div className="user-profile-menu">
              <button
                type="button"
                className="user-pill-btn"
                onClick={() => setActiveTab('profile')}
                title="View Profile"
              >
                <div className="avatar-circle">{userInitials}</div>
                <span className="user-pill-name">{user?.name}</span>
              </button>
              <button
                type="button"
                className="btn-secondary btn-compact"
                onClick={logout}
                title="Log out"
              >
                Log Out
              </button>
            </div>
          ) : (
            <div className="auth-buttons">
              <button
                type="button"
                className="btn-secondary btn-compact"
                onClick={() => onOpenAuthModal?.('login')}
              >
                Sign In
              </button>
              <button
                type="button"
                className="btn-send btn-compact"
                onClick={() => onOpenAuthModal?.('register')}
              >
                Register
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sub-header Toolbar when on API Tester tab */}
      {activeTab === 'tester' && (
        <div className="tester-sub-bar">
          <div className="sub-bar-group">
            <span className="sub-bar-label">Quick Presets</span>
            <select
              id="preset-loader"
              className="preset-select"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  const preset = PRESETS.find((p) => p.id === e.target.value);
                  if (preset) onSelectPreset(preset);
                  e.target.value = '';
                }
              }}
              aria-label="Load Example Preset"
            >
              <option value="" disabled>
                ⚡ Load Example Preset...
              </option>
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sub-bar-group">
            {isAuthenticated ? (
              <span className="history-status active">
                <span className="dot-live"></span>
                History logging active
              </span>
            ) : (
              <span
                className="history-status hint"
                role="button"
                tabIndex={0}
                onClick={() => onOpenAuthModal?.('login')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onOpenAuthModal?.('login');
                }}
              >
                💡 Sign in to save request history
              </span>
            )}
            <button
              id="btn-reset-form"
              type="button"
              className="btn-secondary btn-compact"
              onClick={onReset}
              title="Reset form to defaults"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
