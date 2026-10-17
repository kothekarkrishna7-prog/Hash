import React, { useState } from 'react';
import { highlightJson } from '../utils/jsonHighlighter.js';

export default function HistoryDetailModal({ record, onClose, onRerun, onDelete }) {
  const [activeTab, setActiveTab] = useState('responseBody'); // 'responseBody' | 'responseHeaders' | 'requestHeaders' | 'requestBody'
  const [copied, setCopied] = useState(false);

  if (!record) return null;

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusNum = record.status_code;
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

  const reqHeaders = record.request_headers || {};
  const resHeaders = record.response_headers || {};
  const reqHeaderKeys = Object.keys(reqHeaders);
  const resHeaderKeys = Object.keys(resHeaders);

  const formattedDate = new Date(record.timestamp).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium'
  });

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card history-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span className={`method-select ${record.method}`} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
              {record.method}
            </span>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, wordBreak: 'break-all' }}>
                {record.url}
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Executed on {formattedDate}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn-close-modal"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Overview Bar */}
        <div className="response-overview-bar" style={{ marginTop: '0.85rem' }}>
          {record.status_code ? (
            <div className={`status-badge ${statusClass}`}>
              <span>{record.status_code} {record.status_text || ''}</span>
              <span style={{ opacity: 0.75, fontSize: '0.72rem' }}>— {statusLabel}</span>
            </div>
          ) : (
            <div className="status-badge status-5xx">
              <span>{record.error_code || 'EXECUTION_FAILED'}</span>
            </div>
          )}

          <div className="metrics-pills">
            {record.time_ms !== null && (
              <div className="metric-pill">
                ⚡ Time: <strong>{record.time_ms} ms</strong>
              </div>
            )}
            <div className="metric-pill">
              📦 Size: <strong>{formatBytes(record.size_bytes)}</strong>
            </div>
            {record.total_checks > 0 && (
              <div className="metric-pill">
                ✓ Checks: <strong>{record.passed_checks}/{record.total_checks} passed</strong>
              </div>
            )}
          </div>
        </div>

        {/* Error notice if present */}
        {record.error_message && (
          <div className="auth-alert error" style={{ marginTop: '0.75rem' }}>
            <strong>Error:</strong> {record.error_message}
          </div>
        )}

        {/* Tabs */}
        <div className="tab-row" style={{ marginTop: '0.85rem' }}>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'responseBody' ? 'active' : ''}`}
            onClick={() => setActiveTab('responseBody')}
          >
            Response Body
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'responseHeaders' ? 'active' : ''}`}
            onClick={() => setActiveTab('responseHeaders')}
          >
            Response Headers ({resHeaderKeys.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'requestBody' ? 'active' : ''}`}
            onClick={() => setActiveTab('requestBody')}
          >
            Request Body
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'requestHeaders' ? 'active' : ''}`}
            onClick={() => setActiveTab('requestHeaders')}
          >
            Request Headers ({reqHeaderKeys.length})
          </button>
        </div>

        {/* Tab 1: Response Body */}
        {activeTab === 'responseBody' && (
          <div className="code-viewer-container" style={{ marginTop: '0.5rem' }}>
            <div className="viewer-top-bar">
              <span>Target API Response Payload</span>
              {record.response_body && (
                <button
                  type="button"
                  className="btn-copy"
                  onClick={() => handleCopy(record.response_body)}
                >
                  {copied ? '✓ Copied' : 'Copy Response'}
                </button>
              )}
            </div>
            <div
              className="code-viewer-scroll"
              style={{ maxHeight: '280px' }}
              dangerouslySetInnerHTML={{
                __html: record.response_body ? highlightJson(record.response_body) : '<span style="color:var(--text-muted);">(Empty body)</span>'
              }}
            />
          </div>
        )}

        {/* Tab 2: Response Headers */}
        {activeTab === 'responseHeaders' && (
          <div className="code-viewer-container" style={{ marginTop: '0.5rem', maxHeight: '280px', overflow: 'auto' }}>
            <table className="headers-table">
              <thead>
                <tr>
                  <th>Header Key</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {resHeaderKeys.length === 0 ? (
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No response headers recorded
                    </td>
                  </tr>
                ) : (
                  resHeaderKeys.map((k) => (
                    <tr key={k}>
                      <td className="key">{k}</td>
                      <td className="val">{resHeaders[k]}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Request Body */}
        {activeTab === 'requestBody' && (
          <div className="code-viewer-container" style={{ marginTop: '0.5rem' }}>
            <div className="viewer-top-bar">
              <span>Sanitized Request Payload Sent to Target</span>
              {record.request_body && (
                <button
                  type="button"
                  className="btn-copy"
                  onClick={() => handleCopy(record.request_body)}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              )}
            </div>
            <div
              className="code-viewer-scroll"
              style={{ maxHeight: '280px' }}
              dangerouslySetInnerHTML={{
                __html: record.request_body ? highlightJson(record.request_body) : '<span style="color:var(--text-muted);">(No request body sent)</span>'
              }}
            />
          </div>
        )}

        {/* Tab 4: Request Headers */}
        {activeTab === 'requestHeaders' && (
          <div className="code-viewer-container" style={{ marginTop: '0.5rem', maxHeight: '280px', overflow: 'auto' }}>
            <table className="headers-table">
              <thead>
                <tr>
                  <th>Header Key</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {reqHeaderKeys.length === 0 ? (
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No custom headers sent
                    </td>
                  </tr>
                ) : (
                  reqHeaderKeys.map((k) => (
                    <tr key={k}>
                      <td className="key">{k}</td>
                      <td className="val">{reqHeaders[k]}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
          <button
            type="button"
            className="btn-icon-danger"
            style={{ padding: '0.5rem 0.85rem', gap: '0.4rem', fontSize: '0.78rem' }}
            onClick={() => {
              if (confirm('Are you sure you want to delete this history record?')) {
                onDelete?.(record.id);
                onClose?.();
              }
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete Record
          </button>

          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="btn-send"
              style={{ padding: '0.5rem 1.15rem', fontSize: '0.84rem' }}
              onClick={() => {
                onRerun?.(record);
                onClose?.();
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              Rerun in API Tester
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
