import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function DashboardView({
  backendUrl,
  onNavigateToTester,
  onNavigateToHistory,
  onRerunRequest
}) {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalRequests: 0,
    successfulResponses: 0,
    failedExecutions: 0,
    validationPassRate: null
  });
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/dashboard/stats`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setRecentRequests(data.recentRequests || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <div className="dashboard-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Welcome Banner */}
      <div className="card dashboard-welcome-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>
              Welcome back, {user?.name || 'Developer'} 👋
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
              API Sentinel testing dashboard & automated assertion engine
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onNavigateToHistory}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              View History
            </button>
            <button
              type="button"
              className="btn-send"
              onClick={onNavigateToTester}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              New API Test
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label">Total API Requests</span>
            <div style={{ color: 'var(--accent-cyan)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
          </div>
          <div className="metric-value" style={{ fontSize: '1.8rem', marginTop: '0.5rem' }}>
            {loading ? '...' : stats.totalRequests}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Recorded executions</span>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label">Successful HTTP</span>
            <div style={{ color: 'var(--color-success)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
          </div>
          <div className="metric-value passed" style={{ fontSize: '1.8rem', marginTop: '0.5rem' }}>
            {loading ? '...' : stats.successfulResponses}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>2xx / 3xx responses</span>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label">Failed Executions</span>
            <div style={{ color: 'var(--color-danger)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
          </div>
          <div className="metric-value failed" style={{ fontSize: '1.8rem', marginTop: '0.5rem' }}>
            {loading ? '...' : stats.failedExecutions}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Errors, timeouts & 4xx/5xx</span>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label">Validation Pass Rate</span>
            <div style={{ color: 'var(--accent-cyan)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
          </div>
          <div className="metric-value pct" style={{ fontSize: '1.8rem', marginTop: '0.5rem' }}>
            {loading ? '...' : stats.validationPassRate !== null ? `${stats.validationPassRate}%` : 'N/A'}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Assertion checks passed</span>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Recent Test Activity
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Latest executions recorded in your account
            </span>
          </div>

          {recentRequests.length > 0 && (
            <button
              type="button"
              className="link-btn"
              onClick={onNavigateToHistory}
              style={{ fontSize: '0.82rem' }}
            >
              View Complete History →
            </button>
          )}
        </div>

        {loading ? (
          <div className="state-box" style={{ padding: '2rem' }}>
            <div className="spinner" />
          </div>
        ) : recentRequests.length === 0 ? (
          <div className="state-box" style={{ padding: '2rem' }}>
            <div className="state-title">No Recent Activity</div>
            <div className="state-desc">
              Your test history is currently empty. Run your first test in the API Tester!
            </div>
            <button
              type="button"
              className="btn-send"
              style={{ marginTop: '0.5rem' }}
              onClick={onNavigateToTester}
            >
              ⚡ Open API Tester
            </button>
          </div>
        ) : (
          <div className="history-table-container">
            <table className="headers-table history-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Endpoint</th>
                  <th>Status</th>
                  <th>Latency</th>
                  <th>Checks</th>
                  <th>Time</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentRequests.map((r) => {
                  let badgeCls = 'status-2xx';
                  if (r.status_code >= 400 && r.status_code < 500) badgeCls = 'status-4xx';
                  else if (r.status_code >= 500 || !r.status_code) badgeCls = 'status-5xx';
                  else if (r.status_code >= 300) badgeCls = 'status-3xx';

                  const timeAgo = new Date(r.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <tr key={r.id}>
                      <td>
                        <span className={`method-select ${r.method}`} style={{ padding: '0.2rem 0.5rem', fontSize: '0.74rem' }}>
                          {r.method}
                        </span>
                      </td>
                      <td style={{ maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                          {r.url}
                        </span>
                      </td>
                      <td>
                        {r.status_code ? (
                          <span className={`status-badge ${badgeCls}`} style={{ fontSize: '0.72rem', padding: '0.18rem 0.5rem' }}>
                            {r.status_code}
                          </span>
                        ) : (
                          <span className="status-badge status-5xx" style={{ fontSize: '0.72rem', padding: '0.18rem 0.5rem' }}>
                            {r.execution_result}
                          </span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {r.time_ms !== null ? `${r.time_ms} ms` : '—'}
                      </td>
                      <td>
                        {r.total_checks > 0 ? (
                          <span className={`badge-result ${r.failed_checks === 0 ? 'pass' : 'fail'}`} style={{ fontSize: '0.7rem' }}>
                            {r.passed_checks}/{r.total_checks} Pass
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-subtle)', fontSize: '0.74rem' }}>—</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {timeAgo}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', color: 'var(--accent-cyan)' }}
                          onClick={() => onRerunRequest(r)}
                        >
                          Rerun
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
