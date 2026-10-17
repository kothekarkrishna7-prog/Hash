import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { requireAuth, clearSessionCookie } from './auth.js';

export function setupUserRoutes(router) {
  // GET /api/user/profile
  router.get('/user/profile', requireAuth, (req, res) => {
    const userId = req.user.id;

    // Fetch user details
    const user = db.prepare('SELECT id, name, email, created_at, updated_at FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'User not found.' }
      });
    }

    // Compute statistics directly from request_history
    try {
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total_requests,
          SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as successful_responses,
          SUM(CASE WHEN (status_code IS NULL OR status_code < 200 OR status_code >= 300) THEN 1 ELSE 0 END) as failed_executions,
          SUM(CASE WHEN total_checks > 0 AND failed_checks = 0 THEN 1 ELSE 0 END) as tests_passed_validation,
          SUM(CASE WHEN total_checks > 0 THEN 1 ELSE 0 END) as tests_with_validation,
          SUM(passed_checks) as total_checks_passed,
          SUM(failed_checks) as total_checks_failed
        FROM request_history
        WHERE user_id = ?
      `).get(userId);

      const totalRequests = Number(stats?.total_requests || 0);
      const successfulResponses = Number(stats?.successful_responses || 0);
      const failedExecutions = Number(stats?.failed_executions || 0);
      const checksPassed = Number(stats?.total_checks_passed || 0);
      const checksFailed = Number(stats?.total_checks_failed || 0);
      const testsWithVal = Number(stats?.tests_with_validation || 0);
      const testsPassedVal = Number(stats?.tests_passed_validation || 0);
      const validationPassRate = testsWithVal > 0 ? Math.round((testsPassedVal / testsWithVal) * 100) : null;

      return res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        },
        stats: {
          totalRequests,
          successfulResponses,
          failedExecutions,
          totalChecksPassed: checksPassed,
          totalChecksFailed: checksFailed,
          validationPassRate
        }
      });
    } catch (err) {
      console.error('[User Profile Error]', err);
      return res.status(500).json({
        error: { code: 'DATABASE_ERROR', message: 'Failed to retrieve profile data: ' + err.message }
      });
    }
  });

  // PUT /api/user/profile (Edit Display Name)
  router.put('/user/profile', requireAuth, (req, res) => {
    const { name } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        error: { code: 'INVALID_NAME', message: 'Name must be at least 2 characters long.' }
      });
    }

    const cleanName = name.trim();
    const now = new Date().toISOString();

    db.prepare('UPDATE users SET name = ?, updated_at = ? WHERE id = ?').run(cleanName, now, req.user.id);

    return res.json({
      user: {
        id: req.user.id,
        name: cleanName,
        email: req.user.email,
        createdAt: req.user.createdAt,
        updatedAt: now
      },
      message: 'Profile updated successfully.'
    });
  });

  // PUT /api/user/password (Change Password)
  router.put('/user/password', requireAuth, (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        error: { code: 'MISSING_FIELDS', message: 'Current password, new password, and confirmation are required.' }
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: { code: 'INVALID_NEW_PASSWORD', message: 'New password must be at least 8 characters long.' }
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        error: { code: 'PASSWORD_MISMATCH', message: 'New password and confirmation do not match.' }
      });
    }

    // Verify current password
    const userRow = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    const matches = bcrypt.compareSync(currentPassword, userRow.password_hash);

    if (!matches) {
      return res.status(401).json({
        error: { code: 'INVALID_CURRENT_PASSWORD', message: 'Current password is incorrect.' }
      });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    const now = new Date().toISOString();

    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, now, req.user.id);

    // Invalidate other sessions for security
    const currentToken = req.cookies?.['sentinel_session'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
    if (currentToken) {
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(req.user.id, currentToken);
    }

    return res.json({
      success: true,
      message: 'Password changed successfully.'
    });
  });

  // DELETE /api/user/account (Account Deletion with Confirmation)
  router.delete('/user/account', requireAuth, (req, res) => {
    const { currentPassword } = req.body || {};

    if (!currentPassword) {
      return res.status(400).json({
        error: { code: 'PASSWORD_REQUIRED', message: 'Please enter your password to confirm account deletion.' }
      });
    }

    const userRow = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    const matches = bcrypt.compareSync(currentPassword, userRow.password_hash);

    if (!matches) {
      return res.status(401).json({
        error: { code: 'INVALID_PASSWORD', message: 'Incorrect password.' }
      });
    }

    // Cascade deletes sessions and request_history
    db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
    clearSessionCookie(res);

    return res.json({
      success: true,
      message: 'Account and all associated test history deleted.'
    });
  });

  // GET /api/dashboard/stats
  router.get('/dashboard/stats', requireAuth, (req, res) => {
    try {
      const userId = req.user.id;

      // Aggregate stats: 200-299 = Successful HTTP; Non-2xx / error = Failed executions
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total_requests,
          SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as successful_responses,
          SUM(CASE WHEN (status_code IS NULL OR status_code < 200 OR status_code >= 300) THEN 1 ELSE 0 END) as failed_executions,
          SUM(CASE WHEN total_checks > 0 AND failed_checks = 0 THEN 1 ELSE 0 END) as tests_passed_validation,
          SUM(CASE WHEN total_checks > 0 THEN 1 ELSE 0 END) as tests_with_validation,
          SUM(passed_checks) as total_checks_passed,
          SUM(failed_checks) as total_checks_failed
        FROM request_history
        WHERE user_id = ?
      `).get(userId);

      const totalRequests = Number(stats?.total_requests || 0);
      const successfulResponses = Number(stats?.successful_responses || 0);
      const failedExecutions = Number(stats?.failed_executions || 0);
      const testsWithVal = Number(stats?.tests_with_validation || 0);
      const testsPassedVal = Number(stats?.tests_passed_validation || 0);
      const validationPassRate = testsWithVal > 0 ? Math.round((testsPassedVal / testsWithVal) * 100) : null;

      // Fetch recent 5 requests
      const recentRequests = db.prepare(`
        SELECT 
          id, url, method, timestamp, status_code, status_text, 
          time_ms, execution_result, total_checks, passed_checks, failed_checks,
          expected_status, error_message, error_code
        FROM request_history
        WHERE user_id = ?
        ORDER BY timestamp DESC
        LIMIT 5
      `).all(userId);

      return res.json({
        stats: {
          totalRequests,
          successfulResponses,
          failedExecutions,
          validationPassRate
        },
        recentRequests
      });
    } catch (err) {
      console.error('[Dashboard API Error]', err);
      return res.status(500).json({
        error: {
          code: 'DATABASE_ERROR',
          message: 'An error occurred while computing dashboard statistics: ' + err.message
        }
      });
    }
  });
}
