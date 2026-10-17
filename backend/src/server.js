import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { executeRequest } from './requestExecutor.js';
import { setupAuthRoutes, optionalAuth, requireAuth } from './auth.js';
import { setupUserRoutes } from './userRoutes.js';
import { setupHistoryRoutes, recordRequestHistory } from './historyRoutes.js';
import { db } from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Allowed origins for CORS (SEC-09)
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'http://localhost:4173'
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        process.env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }
      return callback(new Error('CORS policy: origin not allowed by API Sentinel.'));
    },
    credentials: true, // Allow cookies for authentication sessions
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
  })
);

// Cookie parser for reading session cookies
app.use(cookieParser());

// SEC-12: Limit incoming request body size to 1 MB
app.use(express.json({ limit: '1mb' }));

// SEC-16: Basic security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// Health check endpoint (FR-10, Section 11.1)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'api-sentinel-backend',
    version: '1.1.0',
    timestamp: new Date().toISOString()
  });
});

// Mount Authentication, User Profile, and History routes
const apiRouter = express.Router();
setupAuthRoutes(apiRouter);
setupUserRoutes(apiRouter);
setupHistoryRoutes(apiRouter);

// Endpoint to update validation results on an existing history record
apiRouter.put('/history/:id/validation', requireAuth, (req, res) => {
  const { id } = req.params;
  const { totalChecks = 0, passedChecks = 0, failedChecks = 0, expectedStatus = null } = req.body || {};

  const result = db.prepare(`
    UPDATE request_history
    SET total_checks = ?, passed_checks = ?, failed_checks = ?, expected_status = ?
    WHERE id = ? AND user_id = ?
  `).run(totalChecks, passedChecks, failedChecks, expectedStatus, id, req.user.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Record not found.' } });
  }

  res.json({ success: true, message: 'Validation summary updated.' });
});

app.use('/api', apiRouter);

// Outbound request execution endpoint (Section 11.1 - 11.5) with automatic history recording
app.post('/api/send', optionalAuth, async (req, res) => {
  const {
    url,
    method = 'GET',
    headers = {},
    body = '',
    totalChecks = 0,
    passedChecks = 0,
    failedChecks = 0,
    expectedStatus = null
  } = req.body || {};

  const currentUserId = req.user?.id || null;
  let historyId = null;

  try {
    const result = await executeRequest({
      url,
      method,
      headers,
      body
    });

    // Determine execution result category
    let executionResult = 'success';
    if (result.status >= 400 && result.status < 500) {
      executionResult = 'http_client_error';
    } else if (result.status >= 500) {
      executionResult = 'http_server_error';
    }

    // Save to history if user is authenticated
    if (currentUserId) {
      try {
        historyId = recordRequestHistory(currentUserId, {
          url,
          method,
          requestHeaders: headers,
          requestBody: body,
          statusCode: result.status,
          statusText: result.statusText,
          timeMs: result.timeMs,
          executionResult,
          responseHeaders: result.headers,
          responseBody: result.body,
          sizeBytes: result.sizeBytes,
          totalChecks,
          passedChecks,
          failedChecks,
          expectedStatus
        });
      } catch (histErr) {
        console.error('[History] Failed to record request:', histErr.message);
      }
    }

    // Per Section 11.5: Target response (even 4xx/5xx) returns backend status 200
    res.status(200).json({
      ...result,
      historyId
    });
  } catch (err) {
    const status = err.status || 500;
    const errorCode = err.code || 'INTERNAL_ERROR';
    const errorMessage =
      err.message || 'An unexpected error occurred while executing the request.';

    // Save failed request to history if user is authenticated (Acceptance Criteria 10)
    if (currentUserId && url) {
      try {
        let execRes = 'network_error';
        if (errorCode === 'TIMEOUT') execRes = 'timeout';
        else if (errorCode === 'BLOCKED_DESTINATION') execRes = 'blocked_destination';
        else if (errorCode === 'INVALID_INPUT') execRes = 'invalid_input';

        historyId = recordRequestHistory(currentUserId, {
          url,
          method,
          requestHeaders: headers,
          requestBody: body,
          statusCode: null,
          statusText: null,
          timeMs: err.timeMs || null,
          executionResult: execRes,
          responseHeaders: {},
          responseBody: '',
          sizeBytes: 0,
          totalChecks: 0,
          passedChecks: 0,
          failedChecks: 0,
          expectedStatus,
          errorMessage,
          errorCode
        });
      } catch (histErr) {
        console.error('[History] Failed to record failed request:', histErr.message);
      }
    }

    res.status(status).json({
      error: {
        code: errorCode,
        message: errorMessage
      },
      timeMs: err.timeMs,
      historyId
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.path} not found.`
    }
  });
});

// Global error handler (SEC-11: No stack traces leaked)
app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({
    error: {
      code: err.code || 'SERVER_ERROR',
      message: err.message || 'An unexpected internal error occurred.'
    }
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[API Sentinel Backend] Server running on port ${PORT}`);
    console.log(`[API Sentinel Backend] Health check: http://localhost:${PORT}/health`);
  });
}

export default app;
