import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProfileView({ backendUrl, onNavigateToTester }) {
  const { user, logout, updateProfile, authFetch } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  // Edit Name state
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState('');
  const [nameError, setNameError] = useState('');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setProfileError(null);
    try {
      const res = await authFetch(`${backendUrl}/api/user/profile`);
      if (res.ok) {
        const data = await res.json();
        setProfileData(data);
        setEditName(data.user.name);
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Failed to fetch profile (HTTP ${res.status})`);
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setProfileError(err.message || 'Failed to retrieve profile data.');
    } finally {
      setLoading(false);
    }
  }, [backendUrl, authFetch]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleUpdateName = async (e) => {
    e.preventDefault();
    setNameError('');
    setNameSuccess('');
    if (!editName.trim() || editName.trim().length < 2) {
      setNameError('Name must be at least 2 characters.');
      return;
    }

    setSavingName(true);
    const res = await updateProfile(editName.trim());
    setSavingName(false);

    if (res.success) {
      setNameSuccess('Display name updated successfully.');
      setTimeout(() => setNameSuccess(''), 3000);
    } else {
      setNameError(res.error || 'Failed to update name.');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await authFetch(`${backendUrl}/api/user/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });
      const data = await res.json();
      setSavingPassword(false);

      if (res.ok) {
        setPasswordSuccess('Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccess(''), 4000);
      } else {
        setPasswordError(data.error?.message || 'Failed to change password.');
      }
    } catch (err) {
      setSavingPassword(false);
      setPasswordError(err.message || 'Network error occurred.');
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError('Password is required to delete your account.');
      return;
    }

    setDeleting(true);
    setDeleteError('');
    try {
      const res = await authFetch(`${backendUrl}/api/user/account`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: deletePassword })
      });
      const data = await res.json();
      setDeleting(false);

      if (res.ok) {
        logout();
      } else {
        setDeleteError(data.error?.message || 'Failed to delete account.');
      }
    } catch (err) {
      setDeleting(false);
      setDeleteError(err.message || 'Network error occurred.');
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="state-box" style={{ padding: '3rem' }}>
          <div className="spinner" />
          <div className="state-title">Loading profile...</div>
        </div>
      </div>
    );
  }

  const stats = profileData?.stats || {
    totalRequests: 0,
    successfulResponses: 0,
    failedExecutions: 0,
    totalChecksPassed: 0,
    totalChecksFailed: 0,
    validationPassRate: null
  };

  const createdDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'Recently';

  const userInitials = (user?.name || 'User')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="profile-page">
      {profileError && (
        <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
          {profileError}
        </div>
      )}
      <div className="profile-grid">
        {/* Left Column: Account Info & Edit Profile */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* User Card */}
          <div className="card">
            <div className="profile-header-card">
              <div className="profile-avatar-large">
                {userInitials}
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{user?.name}</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{user?.email}</p>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.35rem' }}>
                  Member since {createdDate}
                </div>
              </div>
            </div>

            {/* Edit Display Name */}
            <form onSubmit={handleUpdateName} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-name-input">
                  Display Name
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    id="edit-name-input"
                    type="text"
                    className="form-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={savingName}
                  />
                  <button
                    type="submit"
                    className="btn-send"
                    style={{ padding: '0.55rem 1rem', fontSize: '0.82rem' }}
                    disabled={savingName || editName.trim() === user?.name}
                  >
                    {savingName ? 'Saving...' : 'Save Name'}
                  </button>
                </div>
                {nameSuccess && <span style={{ color: 'var(--color-success)', fontSize: '0.8rem' }}>{nameSuccess}</span>}
                {nameError && <span className="inline-error">{nameError}</span>}
              </div>
            </form>
          </div>

          {/* Change Password Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title" style={{ fontSize: '0.98rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Change Password
              </h3>
            </div>

            {passwordSuccess && (
              <div className="auth-alert" style={{ background: 'var(--color-success-bg)', borderColor: 'var(--color-success-border)', color: 'var(--color-success)' }}>
                {passwordSuccess}
              </div>
            )}
            {passwordError && (
              <div className="auth-alert error">
                {passwordError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="auth-form">
              <div className="form-group">
                <label className="form-label" htmlFor="current-pw-input">
                  Current Password
                </label>
                <input
                  id="current-pw-input"
                  type="password"
                  className="form-input"
                  placeholder="Enter your current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={savingPassword}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-pw-input">
                  New Password (min. 8 characters)
                </label>
                <input
                  id="new-pw-input"
                  type="password"
                  className="form-input"
                  placeholder="Enter new strong password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={savingPassword}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="confirm-pw-input">
                  Confirm New Password
                </label>
                <input
                  id="confirm-pw-input"
                  type="password"
                  className="form-input"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={savingPassword}
                />
              </div>

              <button
                type="submit"
                className="btn-secondary"
                style={{ padding: '0.6rem 1.25rem', marginTop: '0.25rem' }}
                disabled={savingPassword}
              >
                {savingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>

          {/* Danger Zone */}
          <div className="card" style={{ borderColor: 'var(--color-danger-border)' }}>
            <div className="card-header">
              <h3 className="card-title" style={{ color: 'var(--color-danger)', fontSize: '0.98rem' }}>
                Danger Zone
              </h3>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Delete Account</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Permanently delete your user account and all recorded API request history.
                </div>
              </div>
              <button
                type="button"
                className="btn-icon-danger"
                style={{ padding: '0.5rem 0.9rem', fontSize: '0.8rem' }}
                onClick={() => setShowDeleteModal(true)}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Statistics Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                API Testing Statistics
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Aggregated from your real test logs
              </span>
            </div>

            <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <div className="summary-metric-card">
                <span className="metric-label">Total Requests</span>
                <span className="metric-value">{stats.totalRequests}</span>
              </div>
              <div className="summary-metric-card">
                <span className="metric-label">Successful HTTP (2xx/3xx)</span>
                <span className="metric-value passed">{stats.successfulResponses}</span>
              </div>
              <div className="summary-metric-card">
                <span className="metric-label">Failed Executions</span>
                <span className="metric-value failed">{stats.failedExecutions}</span>
              </div>
              <div className="summary-metric-card">
                <span className="metric-label">Validation Pass Rate</span>
                <span className="metric-value pct">
                  {stats.validationPassRate !== null ? `${stats.validationPassRate}%` : 'N/A'}
                </span>
              </div>
            </div>

            {/* Check Breakdown */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', marginTop: '0.5rem' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Assertions Evaluation Breakdown
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>Passed Checks:</span>
                  <strong style={{ color: 'var(--color-success)' }}>{stats.totalChecksPassed}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>Failed Checks:</span>
                  <strong style={{ color: 'var(--color-danger)' }}>{stats.totalChecksFailed}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>Total Assertions Evaluated:</span>
                  <strong>{stats.totalChecksPassed + stats.totalChecksFailed}</strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn-send"
              style={{ marginTop: '1rem', width: '100%' }}
              onClick={onNavigateToTester}
            >
              ⚡ Launch API Tester
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-backdrop" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--color-danger)' }}>Confirm Account Deletion</h3>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setShowDeleteModal(false)}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.75rem 0' }}>
              This action is permanent and cannot be undone. All your recorded API request history will be permanently deleted.
            </p>

            {deleteError && <div className="auth-alert error">{deleteError}</div>}

            <div className="form-group" style={{ margin: '1rem 0' }}>
              <label className="form-label" htmlFor="delete-pw-input">
                Enter your password to confirm:
              </label>
              <input
                id="delete-pw-input"
                type="password"
                className="form-input"
                placeholder="Your password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                disabled={deleting}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-icon-danger"
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
