import React, { useState, useEffect, useCallback } from 'react';
import HistoryDetailModal from './HistoryDetailModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function HistoryView({
  backendUrl,
  onRerunRequest,
  onNavigateToTester,
  refreshTrigger,
  onOpenAuthModal
}) {
  const { isAuthenticated, authFetch } = useAuth();
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('ALL');
  const [statusCode, setStatusCode] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected record for detail modal
  const [selectedRecord, setSelectedRecord] = useState(null);

  const fetchHistory = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      setFetchError(null);
      return;
    }

    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (method !== 'ALL') params.append('method', method);
      if (statusCode !== 'ALL') params.append('statusCode', statusCode);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      params.append('page', String(page));
      params.append('limit', '10');

      const res = await authFetch(`${backendUrl}/api/history?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Failed to fetch history (HTTP ${res.status}).`);
      }
      const data = await res.json();
      setRecords(data.records || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Failed to load history:', err);
      setFetchError(err.message || 'Unable to retrieve request history.');
    } finally {
      setLoading(false);
    }
  }, [backendUrl, search, method, statusCode, startDate, endDate, page, isAuthenticated, authFetch]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, refreshTrigger]);

  const handleOpenDetail = async (id) => {
    try {
      const res = await authFetch(`${backendUrl}/api/history/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedRecord(data.record);
      }
    } catch (err) {
      console.error('Failed to fetch history details:', err);
    }
  };

  const handleDeleteRecord = async (id) => {
    try {
      const res = await authFetch(`${backendUrl}/api/history/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setRecords((prev) => prev.filter((r) => r.id !== id));
        setTotal((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to delete history record:', err);
    }
  };

  const handleClearAllHistory = async () => {
    if (!confirm('Are you sure you want to permanently clear all your API request history?')) {
      return;
    }
    try {
      const res = await authFetch(`${backendUrl}/api/history`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setRecords([]);
        setTotal(0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setMethod('ALL');
    setStatusCode('ALL');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  if (!isAuthenticated) {
    return (
      <div className="history-page">
        <div className="card state-box" style={{ padding: '3.5rem 2rem' }}>
          <div className="state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className="state-title">Sign In to View Request History</div>
          <div className="state-desc" style={{ maxWidth: '420px', margin: '0 auto' }}>
            API Sentinel logs all requests, response headers, payloads, latency, and assertion reports to your user account.
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
    <div className="history-page">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              API Request History
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Persistent log of all executed requests, latency, and assertions
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {total > 0 && (
              <button
                type="button"
                className="btn-icon-danger"
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem', gap: '0.35rem' }}
                onClick={handleClearAllHistory}
                title="Clear all saved requests"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Clear All
              </button>
            )}
            <button
              type="button"
              className="btn-send"
              style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
              onClick={onNavigateToTester}
            >
              + New API Test
            </button>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="history-toolbar">
          <div className="search-input-wrapper">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="form-input"
              placeholder="Search by endpoint URL..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{ paddingLeft: '2.1rem' }}
            />
          </div>

          <div className="filter-group">
            <select
              className="preset-select"
              value={method}
              onChange={(e) => {
                setMethod(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by method"
            >
              <option value="ALL">All Methods</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>

            <select
              className="preset-select"
              value={statusCode}
              onChange={(e) => {
                setStatusCode(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by status"
            >
              <option value="ALL">All Statuses</option>
              <option value="2xx">2xx Success</option>
              <option value="3xx">3xx Redirect</option>
              <option value="4xx">4xx Client Error</option>
              <option value="5xx">5xx Server Error</option>
            </select>

            <button
              type="button"
              className="btn-secondary"
              onClick={resetFilters}
              title="Reset all filters"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Table / List */}
        {loading ? (
          <div className="state-box" style={{ padding: '3rem' }}>
            <div className="spinner" />
            <div className="state-title">Loading history...</div>
          </div>
        ) : fetchError ? (
          <div className="state-box" style={{ padding: '3rem' }}>
            <div className="state-icon" style={{ color: 'var(--color-danger)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className="state-title" style={{ color: 'var(--color-danger)' }}>Unable to Load Request History</div>
            <div className="state-desc" style={{ maxWidth: '460px', margin: '0.5rem auto' }}>
              {fetchError}
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={fetchHistory}
              style={{ marginTop: '0.75rem' }}
            >
              🔄 Retry Loading History
            </button>
          </div>
        ) : records.length === 0 ? (
          <div className="state-box">
            <div className="state-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="state-title">No Request History Found</div>
            <div className="state-desc">
              {search || method !== 'ALL' || statusCode !== 'ALL'
                ? 'No requests match your current filters. Try resetting your search filters.'
                : 'You have not executed any API tests yet. Test an endpoint to record your first execution!'}
            </div>
            <button
              type="button"
              className="btn-send"
              onClick={onNavigateToTester}
              style={{ marginTop: '0.5rem' }}
            >
              ⚡ Perform First API Test
            </button>
          </div>
        ) : (
          <div className="history-table-container">
            <table className="headers-table history-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Endpoint URL</th>
                  <th>Status</th>
                  <th>Latency</th>
                  <th>Assertions</th>
                  <th>Executed At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  let badgeCls = 'status-2xx';
                  if (r.status_code >= 400 && r.status_code < 500) badgeCls = 'status-4xx';
                  else if (r.status_code >= 500 || !r.status_code) badgeCls = 'status-5xx';
                  else if (r.status_code >= 300) badgeCls = 'status-3xx';

                  const dateStr = new Date(r.timestamp).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <tr key={r.id}>
                      <td>
                        <span className={`method-select ${r.method}`} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                          {r.method}
                        </span>
                      </td>
                      <td style={{ maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => handleOpenDetail(r.id)}
                          title="Click to view details"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', textAlign: 'left' }}
                        >
                          {r.url}
                        </button>
                      </td>
                      <td>
                        {r.status_code ? (
                          <span className={`status-badge ${badgeCls}`} style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}>
                            {r.status_code}
                          </span>
                        ) : (
                          <span className="status-badge status-5xx" style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}>
                            {r.error_code || 'ERROR'}
                          </span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {r.time_ms !== null ? `${r.time_ms} ms` : '—'}
                      </td>
                      <td>
                        {r.total_checks > 0 ? (
                          <span
                            className={`badge-result ${r.failed_checks === 0 ? 'pass' : 'fail'}`}
                            style={{ fontSize: '0.72rem' }}
                          >
                            {r.passed_checks}/{r.total_checks} Pass
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-subtle)', fontSize: '0.75rem' }}>None</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {dateStr}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                            onClick={() => handleOpenDetail(r.id)}
                            title="Inspect request and response payload"
                          >
                            Inspect
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', color: 'var(--accent-cyan)', borderColor: 'rgba(0, 242, 254, 0.3)' }}
                            onClick={() => onRerunRequest(r)}
                            title="Pre-populate in API Tester"
                          >
                            Rerun
                          </button>
                          <button
                            type="button"
                            className="btn-icon-danger"
                            onClick={() => {
                              if (confirm('Delete this record?')) handleDeleteRecord(r.id);
                            }}
                            title="Delete record"
                            aria-label="Delete history record"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination-bar">
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Showing {records.length} of {total} records
            </span>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', padding: '0 0.5rem' }}>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* History Detail Modal */}
      {selectedRecord && (
        <HistoryDetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onRerun={onRerunRequest}
          onDelete={handleDeleteRecord}
        />
      )}
    </div>
  );
}
