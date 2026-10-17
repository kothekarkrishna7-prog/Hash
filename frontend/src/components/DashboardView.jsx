import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function DashboardView({
  backendUrl,
  onNavigateToTester,
  onNavigateToHistory,
  onRerunRequest,
  refreshTrigger,
  onOpenAuthModal
}) {
  const { user, isAuthenticated, authFetch } = useAuth();
  const [stats, setStats] = useState({
    totalRequests: 0,
    successfulResponses: 0,
    failedExecutions: 0,
    validationPassRate: null
  });
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      setFetchError(null);
      return;
    }

    setLoading(true);
    setFetchError(null);
    try {
      const res = await authFetch(`${backendUrl}/api/dashboard/stats`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Failed to load dashboard data (HTTP ${res.status}).`);
      }
      const data = await res.json();
      setStats(data.stats || {
        totalRequests: 0,
        successfulResponses: 0,
        failedExecutions: 0,
        validationPassRate: null
      });
      setRecentRequests(data.recentRequests || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setFetchError(err.message || 'Failed to load dashboard metrics from backend.');
    } finally {
      setLoading(false);
    }
  }, [backendUrl, isAuthenticated, authFetch]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData, refreshTrigger]);

  if (!isAuthenticated) {
    return (
      <div className="dashboard-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="card state-box" style={{ padding: '3.5rem 2rem' }}>
          <div className="state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className="state-title">Sign In to Access Dashboard</div>
          <div className="state-desc" style={{ maxWidth: '420px', margin: '0 auto' }}>
            API Sentinel saves your test executions, assertion metrics, latency graphs, and historical logs to your account.
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              className="btn-send"
              onClick={onOpenAuthModal}
            >
              🔐 Sign In or Create Account
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={onNavigateToTester}
            >
              Open API Tester
            </button>
          </div>
        </div>
      </div>
    );
  }

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

      {fetchError && (
        <div className="card" style={{ borderColor: 'var(--color-danger)', background: 'rgba(239, 68, 68, 0.08)', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ color: 'var(--color-danger)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--color-danger)', fontSize: '0.9rem' }}>
                  Unable to load dashboard metrics
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {fetchError}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={fetchDashboardData}
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
            >
              🔄 Retry Loading
            </button>
          </div>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label">Total API Tests</span>
            <div style={{ color: 'var(--accent-cyan)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
          </div>
          <div className="metric-value" style={{ fontSize: '1.8rem', marginTop: '0.5rem' }}>
            {loading ? '...' : stats.totalRequests}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>All saved test records</span>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label">Successful Requests</span>
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
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>HTTP 200–299 responses</span>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label">Failed Requests</span>
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
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Non-2xx & failed executions</span>
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
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Tests passing validations</span>
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
