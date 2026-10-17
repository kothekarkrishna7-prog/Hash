import React, { useState } from 'react';

export default function ValidationConfig({
  expectedStatus,
  setExpectedStatus,
  requireValidJson,
  setRequireValidJson,
  requiredFields,
  setRequiredFields,
  maxTimeMs,
  setMaxTimeMs
}) {
  const [fieldInput, setFieldInput] = useState('');

  const handleAddField = () => {
    const trimmed = fieldInput.trim();
    if (trimmed && !requiredFields.includes(trimmed)) {
      setRequiredFields([...requiredFields, trimmed]);
      setFieldInput('');
    }
  };

  const handleRemoveField = (field) => {
    setRequiredFields(requiredFields.filter((f) => f !== field));
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Validation Rules
        </h2>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Automated Response Assertions
        </span>
      </div>

      <div className="validation-config">
        {/* Expected Status Code */}
        <div className="form-group">
          <label htmlFor="expected-status-input" className="form-label">
            <span>Expected HTTP Status Code</span>
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              (100 - 599)
            </span>
          </label>
          <input
            id="expected-status-input"
            type="number"
            className="form-input"
            placeholder="e.g. 200, 201, 404 (Leave empty for no status check)"
            min="100"
            max="599"
            value={expectedStatus ?? ''}
            onChange={(e) => setExpectedStatus(e.target.value)}
          />
          <span className="form-helper">
            Asserts that target API returns this exact numeric status code.
          </span>
        </div>

        {/* JSON Syntax Check Toggle */}
        <div
          id="toggle-json-validity"
          className="toggle-switch-container"
          onClick={() => setRequireValidJson(!requireValidJson)}
          role="switch"
          aria-checked={requireValidJson}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              setRequireValidJson(!requireValidJson);
            }
          }}
        >
          <div>
            <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Response Must Be Valid JSON
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Fails if the returned body is malformed, HTML, or empty
            </div>
          </div>
          <div className={`toggle-switch ${requireValidJson ? 'active' : ''}`}>
            <div className="toggle-knob" />
          </div>
        </div>

        {/* Required JSON Fields */}
        <div className="form-group">
          <label htmlFor="required-fields-input" className="form-label">
            <span>Required Top-Level JSON Fields</span>
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              ({requiredFields.length} configured)
            </span>
          </label>
          <div className="tags-input-container">
            {requiredFields.map((field) => (
              <span key={field} className="field-tag">
                {field}
                <button
                  type="button"
                  className="tag-remove"
                  onClick={() => handleRemoveField(field)}
                  aria-label={`Remove field ${field}`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </span>
            ))}
            <input
              id="required-fields-input"
              type="text"
              className="tags-text-input"
              placeholder={requiredFields.length === 0 ? "Type field name (e.g. 'id') & press Enter" : 'Add field...'}
              value={fieldInput}
              onChange={(e) => setFieldInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddField();
                }
              }}
            />
          </div>
          <span className="form-helper">
            Each property is checked for presence on the top-level JSON response object.
          </span>
        </div>

        {/* Response Time Threshold (P1) */}
        <div className="form-group">
          <label htmlFor="max-time-input" className="form-label">
            <span>Max Response Time Threshold</span>
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Optional SLA check
            </span>
          </label>
          <input
            id="max-time-input"
            type="number"
            className="form-input"
            placeholder="e.g. 1000 (ms)"
            min="10"
            max="60000"
            value={maxTimeMs ?? ''}
            onChange={(e) => setMaxTimeMs(e.target.value)}
          />
          <span className="form-helper">
            Asserts that the round-trip API latency is under this threshold in milliseconds.
          </span>
        </div>

        {/* Disclaimer per FR-29 */}
        <div className="disclaimer-box" role="note">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div>
            <strong>Validation Notice:</strong> A passing status code or valid JSON check alone does not prove the external service is functionally correct. Always verify critical payload schemas.
          </div>
        </div>
      </div>
    </div>
  );
}
