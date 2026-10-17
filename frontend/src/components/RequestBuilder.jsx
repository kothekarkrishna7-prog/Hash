import React, { useState } from 'react';

const COMMON_HEADERS = [
  { key: 'Content-Type', value: 'application/json' },
  { key: 'Accept', value: 'application/json' },
  { key: 'Authorization', value: 'Bearer YOUR_TOKEN' }
];

export default function RequestBuilder({
  method,
  setMethod,
  url,
  setUrl,
  headers,
  setHeaders,
  body,
  setBody,
  onSend,
  isLoading,
  urlError,
  bodyError
}) {
  const [activeTab, setActiveTab] = useState('headers'); // 'headers' | 'body'
  const [curlCopied, setCurlCopied] = useState(false);

  const handleCopyCurl = () => {
    let curl = `curl -X ${method} "${url || 'https://api.example.com'}"`;
    headers.forEach((h) => {
      if (h.key.trim()) {
        curl += ` \\\n  -H "${h.key.trim()}: ${h.value}"`;
      }
    });
    if (method !== 'GET' && body) {
      const escaped = body.replace(/"/g, '\\"');
      curl += ` \\\n  -d "${escaped}"`;
    }
    navigator.clipboard.writeText(curl);
    setCurlCopied(true);
    setTimeout(() => setCurlCopied(false), 2000);
  };

  const handleAddHeader = () => {
    setHeaders([...headers, { key: '', value: '' }]);
  };

  const handleRemoveHeader = (index) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const handleHeaderChange = (index, field, val) => {
    const updated = [...headers];
    updated[index][field] = val;
    setHeaders(updated);
  };

  const handleAddCommonHeader = (h) => {
    // Check if key already exists
    const exists = headers.some(
      (item) => item.key.toLowerCase() === h.key.toLowerCase()
    );
    if (!exists) {
      setHeaders([...headers, { ...h }]);
    }
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(body);
      setBody(JSON.stringify(parsed, null, 2));
    } catch {
      // Keep unchanged if invalid
    }
  };

  const isBodyAllowed = method !== 'GET';

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Request Builder
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            id="copy-curl"
            type="button"
            className="btn-secondary"
            onClick={handleCopyCurl}
            title="Copy as cURL command"
            style={{ fontSize: '0.74rem', padding: '0.28rem 0.65rem' }}
          >
            {curlCopied ? '✓ Copied cURL' : 'Copy cURL'}
          </button>
        </div>
      </div>

      {/* URL & Method Row */}
      <div className="url-bar-group">
        <select
          id="method-selector"
          className={`method-select ${method}`}
          value={method}
          onChange={(e) => {
            const nextMethod = e.target.value;
            setMethod(nextMethod);
            if (nextMethod !== 'GET' && activeTab === 'headers' && !body) {
              // Stay on active tab or switch
            }
          }}
          disabled={isLoading}
          aria-label="HTTP Method"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>

        <div className="url-input-wrapper">
          <input
            id="url-input"
            type="url"
            className={`url-input ${urlError ? 'error' : ''}`}
            placeholder="https://api.example.com/v1/resource"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSend();
              }
            }}
            disabled={isLoading}
            aria-label="Target API URL"
          />
        </div>

        <button
          id="btn-send-request"
          type="button"
          className="btn-send"
          onClick={onSend}
          disabled={isLoading}
          aria-label="Send Request"
        >
          {isLoading ? (
            <>
              <div
                style={{
                  width: '13px',
                  height: '13px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#FFFFFF',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite'
                }}
              />
              Sending...
            </>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              Send Request
            </>
          )}
        </button>
      </div>

      {urlError && (
        <div className="inline-error" role="alert">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {urlError}
        </div>
      )}

      {/* Tabs: Headers / Body */}
      <div className="tab-row">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'headers' ? 'active' : ''}`}
          onClick={() => setActiveTab('headers')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="14" y2="12" />
            <line x1="4" y1="18" x2="18" y2="18" />
          </svg>
          Headers ({headers.filter((h) => h.key.trim().length > 0).length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'body' ? 'active' : ''}`}
          onClick={() => setActiveTab('body')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          Request Body {!isBodyAllowed && '(Disabled for GET)'}
        </button>
      </div>

      {/* Headers Panel */}
      {activeTab === 'headers' && (
        <div className="headers-container">
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quick add:</span>
            {COMMON_HEADERS.map((ch) => (
              <button
                key={ch.key}
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                onClick={() => handleAddCommonHeader(ch)}
              >
                + {ch.key}
              </button>
            ))}
          </div>

          {headers.map((h, idx) => (
            <div key={idx} className="header-row">
              <input
                type="text"
                className="header-input"
                placeholder="Header Name (e.g. Accept)"
                value={h.key}
                onChange={(e) => handleHeaderChange(idx, 'key', e.target.value)}
                disabled={isLoading}
              />
              <input
                type="text"
                className="header-input"
                placeholder="Value (e.g. application/json)"
                value={h.value}
                onChange={(e) => handleHeaderChange(idx, 'value', e.target.value)}
                disabled={isLoading}
              />
              <button
                type="button"
                className="btn-icon-danger"
                onClick={() => handleRemoveHeader(idx)}
                title="Remove header"
                disabled={isLoading}
                aria-label={`Remove header row ${idx + 1}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}

          <button
            id="btn-add-header"
            type="button"
            className="btn-secondary"
            onClick={handleAddHeader}
            disabled={isLoading}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Header
          </button>
        </div>
      )}

      {/* Body Panel */}
      {activeTab === 'body' && (
        <div className="body-editor-container">
          <div className="body-editor-toolbar">
            <span>JSON Payload {isBodyAllowed ? '(Applicable for POST/PUT/PATCH/DELETE)' : ''}</span>
            {isBodyAllowed && body && (
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                onClick={handleFormatJson}
              >
                Prettify JSON
              </button>
            )}
          </div>

          <textarea
            id="body-textarea"
            className="body-textarea"
            placeholder={
              isBodyAllowed
                ? '{\n  "title": "Example Post",\n  "userId": 1\n}'
                : 'GET requests cannot have a payload body.'
            }
            value={isBodyAllowed ? body : ''}
            onChange={(e) => setBody(e.target.value)}
            disabled={!isBodyAllowed || isLoading}
            rows={7}
            aria-label="Request Body JSON"
          />

          {!isBodyAllowed && (
            <div className="disabled-notice">
              HTTP GET requests do not support a payload body. Change the method to POST, PUT, or PATCH to enable this editor.
            </div>
          )}

          {isBodyAllowed && bodyError && (
            <div className="inline-error" role="alert">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {bodyError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
