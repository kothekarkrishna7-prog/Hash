import React from 'react';

export default function TestSummary({
  validationReport,
  hasResponse,
  executionError
}) {
  // If execution failed (e.g. network failure, timeout, SSRF blocked), no assertions are evaluated (FR-27, FR-34)
  if (executionError) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Validation Summary
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--color-danger)' }}>
            Execution aborted
          </span>
        </div>
        <div className="state-box">
          <div className="state-title" style={{ color: 'var(--color-danger)' }}>
            Validation Skipped
          </div>
          <div className="state-desc">
            No assertions were evaluated because the outbound request could not be completed. Fix the destination or network issue to run validation.
          </div>
        </div>
      </div>
    );
  }

  // If no response yet
  if (!hasResponse || !validationReport) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Validation Summary
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Awaiting response
          </span>
        </div>
        <div className="state-box">
          <div className="state-desc">
            After a response is received, the validation engine automatically verifies your configured assertions and renders a complete test report here.
          </div>
        </div>
      </div>
    );
  }

  const {
    total,
    passed,
    failed,
    passPercentage,
    status,
    message,
    assertions
  } = validationReport;

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="m9 15 2 2 4-4" />
          </svg>
          Validation Summary
        </h2>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Real-time assertion checks
        </span>
      </div>

      {/* Outcome Banner (FR-36, FR-35) */}
      <div className={`summary-banner ${status}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {status === 'ALL_PASSED' && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          )}
          {status === 'SOME_FAILED' && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          )}
          {status === 'NO_CHECKS' && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          <span>{message}</span>
        </div>

        {passPercentage !== null && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.05rem', fontWeight: 800 }}>
            {passPercentage}% PASS
          </div>
        )}
      </div>

      {/* Summary Metrics Grid (FR-32) */}
      <div className="summary-grid">
        <div className="summary-metric-card">
          <span className="metric-label">Total Checks</span>
          <span className="metric-value">{total}</span>
        </div>
        <div className="summary-metric-card">
          <span className="metric-label">Passed</span>
          <span className="metric-value passed">{passed}</span>
        </div>
        <div className="summary-metric-card">
          <span className="metric-label">Failed</span>
          <span className="metric-value failed">{failed}</span>
        </div>
        <div className="summary-metric-card">
          <span className="metric-label">Pass Rate</span>
          <span className="metric-value pct">
            {passPercentage !== null ? `${passPercentage}%` : 'N/A'}
          </span>
        </div>
      </div>

      {/* Per-Assertion Cards List (FR-26, FR-33) */}
      {total > 0 && (
        <div className="assertions-list">
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Detailed Check Results ({total})
          </div>

          {assertions.map((assertion) => (
            <div
              key={assertion.id}
              className={`assertion-card ${assertion.passed ? 'pass' : 'fail'}`}
            >
              <div className="assertion-header">
                <span className="assertion-title">{assertion.name}</span>
                <span className={`badge-result ${assertion.passed ? 'pass' : 'fail'}`}>
                  {assertion.passed ? '✓ PASS' : '✗ FAIL'}
                </span>
              </div>

              <div className="assertion-details">
                <div>
                  Expected: <strong>{assertion.expected}</strong>
                </div>
                <div>
                  Actual: <strong>{assertion.actual}</strong>
                </div>
              </div>

              {!assertion.passed && assertion.explanation && (
                <div className="assertion-explanation">
                  {assertion.explanation}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {total === 0 && (
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '0.5rem 0' }}>
          Tip: Add an expected status code, toggle JSON validity, or specify required fields in the Validation Rules panel.
        </div>
      )}
    </div>
  );
}
