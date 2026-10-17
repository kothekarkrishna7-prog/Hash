import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export const PRESETS = [
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

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [backendUrl]);

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
                className="btn-secondary"
                style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem' }}
                onClick={logout}
                title="Log out"
              >
                Log Out
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.42rem 0.85rem' }}
                onClick={() => onOpenAuthModal?.('login')}
              >
                Sign In
              </button>
              <button
                type="button"
                className="btn-send"
                style={{ fontSize: '0.8rem', padding: '0.42rem 0.85rem' }}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Quick Presets:</span>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isAuthenticated ? (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-success)' }}></span>
                History logging active
              </span>
            ) : (
              <span
                style={{ fontSize: '0.75rem', color: 'var(--color-warning)', cursor: 'pointer' }}
                onClick={() => onOpenAuthModal?.('login')}
              >
                💡 Sign in to save request history
              </span>
            )}
            <button
              id="btn-reset-form"
              type="button"
              className="btn-secondary"
              onClick={onReset}
              title="Reset form to defaults"
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
