import React, { useEffect, useState } from 'react';

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
    label: 'Preset 2: POST Create Item (201 Created)',
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
    label: 'Preset 3: GET 404 Endpoint Validation',
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
    label: 'Preset 4: Security Demo (Blocked AWS Metadata)',
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

export default function Header({ backendUrl, onSelectPreset, onReset }) {
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

  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-logo" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(8,12,20,0.4)" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <div className="brand-text">
          <h1>
            API Sentinel
            <span className="brand-badge">MVP v1.0</span>
          </h1>
          <p>Lightweight API Testing, Response Inspection & Assertion Engine</p>
        </div>
      </div>

      <div className="header-actions">
        <div
          className="backend-status-pill"
          title={`Backend health check endpoint: ${backendUrl}/health`}
        >
          <span className={`status-dot ${backendStatus}`}></span>
          <span>
            Backend:{' '}
            {backendStatus === 'online'
              ? 'Online'
              : backendStatus === 'offline'
              ? 'Offline / Disconnected'
              : 'Connecting...'}
          </span>
        </div>

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

        <button
          id="btn-reset-form"
          type="button"
          className="btn-secondary"
          onClick={onReset}
          title="Reset form to defaults"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
          Reset
        </button>
      </div>
    </header>
  );
}
