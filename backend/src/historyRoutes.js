import crypto from 'node:crypto';
import { db } from './db.js';
import { requireAuth } from './auth.js';
import { sanitizeHeaders, sanitizeBody } from './sanitizer.js';

/**
 * Saves a completed API test record to the database for an authenticated user.
 * @param {string} userId
 * @param {Object} data
 * @returns {string} record ID
 */
export function recordRequestHistory(userId, data) {
  if (!userId) return null;

  const id = crypto.randomUUID();
  const timestamp = data.timestamp || new Date().toISOString();

  // Sanitize headers and body to avoid storing secrets
  const cleanReqHeaders = data.requestHeaders ? sanitizeHeaders(data.requestHeaders) : {};
  const cleanReqBody = data.requestBody ? sanitizeBody(data.requestBody) : '';
  const cleanResHeaders = data.responseHeaders ? sanitizeHeaders(data.responseHeaders) : {};

  // Limit response body size stored in DB to 50KB to preserve storage
  let storedResBody = data.responseBody || '';
  if (storedResBody.length > 50000) {
    storedResBody = storedResBody.substring(0, 50000) + '\n... [Truncated for storage]';
  }

  const stmt = db.prepare(`
    INSERT INTO request_history (
      id, user_id, url, method, timestamp,
      status_code, status_text, time_ms, execution_result,
      total_checks, passed_checks, failed_checks, expected_status,
      request_headers, request_body, response_headers, response_body,
      size_bytes, error_message, error_code
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?
    )
  `);

  stmt.run(
    id,
    userId,
    data.url,
    data.method.toUpperCase(),
    timestamp,
    data.statusCode ?? null,
    data.statusText ?? null,
    data.timeMs ?? null,
    data.executionResult || 'success',
    data.totalChecks || 0,
    data.passedChecks || 0,
    data.failedChecks || 0,
    data.expectedStatus ?? null,
    JSON.stringify(cleanReqHeaders),
    cleanReqBody,
    JSON.stringify(cleanResHeaders),
    storedResBody,
    data.sizeBytes || 0,
    data.errorMessage ?? null,
    data.errorCode ?? null
  );

  return id;
}

export function setupHistoryRoutes(router) {
  // GET /api/history (Paginated, Searchable, Filterable)
  router.get('/history', requireAuth, (req, res) => {
    const userId = req.user.id;
    const {
      search = '',
      method = '',
      result = '',
      statusCode = '',
      startDate = '',
      endDate = '',
      page = 1,
      limit = 10
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const conditions = ['user_id = ?'];
    const params = [userId];

    if (search && search.trim()) {
      conditions.push('url LIKE ?');
      params.push(`%${search.trim()}%`);
    }

    if (method && method.trim() && method !== 'ALL') {
      conditions.push('method = ?');
      params.push(method.trim().toUpperCase());
    }

    if (result && result.trim() && result !== 'ALL') {
      conditions.push('execution_result = ?');
      params.push(result.trim().toLowerCase());
    }

    if (statusCode && statusCode.trim() && statusCode !== 'ALL') {
      if (statusCode === '2xx') {
        conditions.push('status_code >= 200 AND status_code < 300');
      } else if (statusCode === '3xx') {
        conditions.push('status_code >= 300 AND status_code < 400');
      } else if (statusCode === '4xx') {
        conditions.push('status_code >= 400 AND status_code < 500');
      } else if (statusCode === '5xx') {
        conditions.push('status_code >= 500');
      } else if (!isNaN(parseInt(statusCode, 10))) {
        conditions.push('status_code = ?');
        params.push(parseInt(statusCode, 10));
      }
    }

    if (startDate && startDate.trim()) {
      conditions.push('timestamp >= ?');
      params.push(startDate.trim());
    }

    if (endDate && endDate.trim()) {
      conditions.push('timestamp <= ?');
      params.push(endDate.trim());
    }

    const whereClause = conditions.join(' AND ');

    // Total count
    const countRow = db.prepare(`SELECT COUNT(*) as count FROM request_history WHERE ${whereClause}`).get(...params);
    const total = Number(countRow.count || 0);

    // Records
    const records = db.prepare(`
      SELECT 
        id, url, method, timestamp, status_code, status_text,
        time_ms, execution_result, total_checks, passed_checks, failed_checks,
        expected_status, size_bytes, error_message, error_code
      FROM request_history
      WHERE ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    return res.json({
      records,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1
    });
  });

  // GET /api/history/:id (Detail view, strictly scoped to user)
  router.get('/history/:id', requireAuth, (req, res) => {
    const record = db.prepare(`
      SELECT * FROM request_history
      WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);

    if (!record) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'History record not found or access denied.' }
      });
    }

    // Parse JSON headers safely
    let requestHeaders = {};
    let responseHeaders = {};
    try {
      if (record.request_headers) requestHeaders = JSON.parse(record.request_headers);
    } catch {}
    try {
      if (record.response_headers) responseHeaders = JSON.parse(record.response_headers);
    } catch {}

    return res.json({
      record: {
        ...record,
        request_headers: requestHeaders,
        response_headers: responseHeaders
      }
    });
  });

  // DELETE /api/history/:id (Delete single record)
  router.delete('/history/:id', requireAuth, (req, res) => {
    const result = db.prepare(`
      DELETE FROM request_history
      WHERE id = ? AND user_id = ?
    `).run(req.params.id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'History record not found or already deleted.' }
      });
    }

    return res.json({
      success: true,
      message: 'History record deleted.'
    });
  });

  // DELETE /api/history (Clear entire history for user)
  router.delete('/history', requireAuth, (req, res) => {
    const result = db.prepare('DELETE FROM request_history WHERE user_id = ?').run(req.user.id);

    return res.json({
      success: true,
      deletedCount: result.changes,
      message: 'All request history cleared successfully.'
    });
  });
}
