import React, { useState } from 'react';
import { highlightJson } from '../utils/jsonHighlighter.js';

export default function ResponseViewer({
  response,
  executionError,
  isLoading,
  elapsedMs
}) {
  const [activeTab, setActiveTab] = useState('formatted'); // 'formatted' | 'raw' | 'headers'
  const [copied, setCopied] = useState(false);

  const handleCopyBody = () => {
    if (!response || response.body === undefined) return;
    navigator.clipboard.writeText(response.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Response Viewer
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)' }}>
            Executing outbound request...
          </span>
        </div>
        <div className="state-box">
          <div className="spinner" />
          <div className="state-title">Dispatching Target Request</div>
          <div className="state-desc">
            The API Sentinel backend is applying SSRF security guards, resolving DNS, and performing outbound fetch.
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
            Elapsed: {elapsedMs} ms
          </div>
        </div>
      </div>
    );
  }

  // 2. Execution Error State (FR-21, FR-34)
  if (executionError) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title" style={{ color: 'var(--color-danger)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Execution Error
          </h2>
          <span className="error-code-badge">{executionError.code || 'REQUEST_FAILED'}</span>
        </div>

        <div className="execution-error-card">
          <div className="execution-error-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Request Could Not Be Completed
          </div>
          <div className="execution-error-desc">
            {executionError.message || 'An unexpected failure prevented the request from reaching the destination.'}
          </div>
          {executionError.timeMs !== undefined && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#FCA5A5', marginTop: '0.25rem' }}>
              Duration before abort: {executionError.timeMs} ms
            </div>
          )}
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
          <strong>Troubleshooting tips:</strong>
          <ul style={{ paddingLeft: '1.25rem', marginTop: '0.35rem' }}>
            {executionError.code === 'BLOCKED_DESTINATION' && (
              <li>Internal, localhost, carrier NAT, and cloud metadata (169.254.x.x) addresses are strictly blocked by API Sentinel security guards.</li>
            )}
            {executionError.code === 'TIMEOUT' && (
              <li>Target server took longer than the 15-second timeout limit to respond.</li>
            )}
            {executionError.code === 'NETWORK_ERROR' && (
              <li>Verify the domain name spelling and confirm the remote server is publicly reachable on the web.</li>
            )}
            <li>No assertions were evaluated because no HTTP response was received from the target.</li>
          </ul>
        </div>
      </div>
    );
  }

  // 3. Empty State (FR-20)
  if (!response) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Response Viewer
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Awaiting execution</span>
        </div>
        <div className="state-box">
          <div className="state-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div className="state-title">Ready for API Inspection</div>
          <div className="state-desc">
            Configure your target URL above, set your expected validation criteria, and click <strong>Send Request</strong> to inspect real responses.
          </div>
        </div>
      </div>
    );
  }

  // 4. Success / Received Response State (FR-17, FR-18, FR-19, FR-22)
  const statusNum = response.status;
  let statusClass = 'status-2xx';
  let statusLabel = 'SUCCESS';

  if (statusNum >= 200 && statusNum < 300) {
    statusClass = 'status-2xx';
    statusLabel = 'SUCCESS';
  } else if (statusNum >= 300 && statusNum < 400) {
    statusClass = 'status-3xx';
    statusLabel = 'REDIRECT';
  } else if (statusNum >= 400 && statusNum < 500) {
    statusClass = 'status-4xx';
    statusLabel = 'CLIENT ERROR';
  } else if (statusNum >= 500) {
    statusClass = 'status-5xx';
    statusLabel = 'SERVER ERROR';
  }

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const responseHeaders = response.headers || {};
  const headerKeys = Object.keys(responseHeaders);
  const isBodyEmpty = !response.body || response.body.trim().length === 0;

  let isJson = false;
  let prettyJsonHtml = '';
  if (!isBodyEmpty) {
    try {
      JSON.parse(response.body);
      isJson = true;
      prettyJsonHtml = highlightJson(response.body);
    } catch {
      isJson = false;
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Response Overview
        </h2>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Captured from target API
        </span>
      </div>

      {/* Top Overview Bar */}
      <div className="response-overview-bar">
        <div className={`status-badge ${statusClass}`}>
          <span>{statusNum} {response.statusText || ''}</span>
          <span style={{ opacity: 0.75, fontSize: '0.72rem' }}>— {statusLabel}</span>
        </div>

        <div className="metrics-pills">
          <div className="metric-pill" title="Outbound round-trip time">
            ⚡ Time: <strong>{response.timeMs} ms</strong>
          </div>
          <div className="metric-pill" title="Payload size">
            📦 Size: <strong>{formatBytes(response.sizeBytes)}</strong>
          </div>
          {response.truncated && (
            <div
              className="metric-pill"
              style={{ color: 'var(--color-warning)', borderColor: 'var(--color-warning-border)' }}
            >
              ⚠️ Truncated (1 MB Cap)
            </div>
          )}
        </div>
      </div>

      {/* Viewer Tabs */}
      <div className="tab-row">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'formatted' ? 'active' : ''}`}
          onClick={() => setActiveTab('formatted')}
        >
          Formatted Body {isJson && '(JSON)'}
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'raw' ? 'active' : ''}`}
          onClick={() => setActiveTab('raw')}
        >
          Raw Text
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'headers' ? 'active' : ''}`}
          onClick={() => setActiveTab('headers')}
        >
          Headers ({headerKeys.length})
        </button>
      </div>

      {/* Tab 1: Formatted Body */}
      {activeTab === 'formatted' && (
        <div className="code-viewer-container">
          <div className="viewer-top-bar">
            <span>{isJson ? 'Syntax Highlighted JSON' : 'Plain Text Response'}</span>
            {!isBodyEmpty && (
              <button type="button" className="btn-copy" onClick={handleCopyBody}>
                {copied ? '✓ Copied!' : 'Copy Body'}
              </button>
            )}
          </div>

          {isBodyEmpty ? (
            <div className="state-box" style={{ padding: '2rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                (Empty response body - No content returned by server)
              </div>
            </div>
          ) : isJson ? (
            <div
              className="code-viewer-scroll"
              dangerouslySetInnerHTML={{ __html: prettyJsonHtml }}
            />
          ) : (
            <div className="code-viewer-scroll">{response.body}</div>
          )}
        </div>
      )}

      {/* Tab 2: Raw Text */}
      {activeTab === 'raw' && (
        <div className="code-viewer-container">
          <div className="viewer-top-bar">
            <span>Raw Response Payload</span>
            {!isBodyEmpty && (
              <button type="button" className="btn-copy" onClick={handleCopyBody}>
                {copied ? '✓ Copied!' : 'Copy Body'}
              </button>
            )}
          </div>
          {isBodyEmpty ? (
            <div className="state-box" style={{ padding: '2rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                (Empty response body)
              </div>
            </div>
          ) : (
            <div className="code-viewer-scroll">{response.body}</div>
          )}
        </div>
      )}

      {/* Tab 3: Response Headers */}
      {activeTab === 'headers' && (
        <div className="code-viewer-container">
          <div className="viewer-top-bar">
            <span>HTTP Response Headers</span>
            <span>{headerKeys.length} items</span>
          </div>
          <div style={{ maxHeight: '380px', overflow: 'auto' }}>
            <table className="headers-table">
              <thead>
                <tr>
                  <th>Header Key</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {headerKeys.length === 0 ? (
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No headers returned
                    </td>
                  </tr>
                ) : (
                  headerKeys.map((key) => (
                    <tr key={key}>
                      <td className="key">{key}</td>
                      <td className="val">{responseHeaders[key]}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
