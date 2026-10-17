import express from 'express';
import cors from 'cors';
import { executeRequest } from './requestExecutor.js';

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
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

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
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Outbound request execution endpoint (Section 11.1 - 11.5)
app.post('/api/send', async (req, res) => {
  const { url, method = 'GET', headers = {}, body = '' } = req.body || {};

  try {
    const result = await executeRequest({
      url,
      method,
      headers,
      body
    });

    // Per Section 11.5: Target response (even 4xx/5xx) returns backend status 200
    res.status(200).json(result);
  } catch (err) {
    const status = err.status || 500;
    const errorCode = err.code || 'INTERNAL_ERROR';
    const errorMessage =
      err.message || 'An unexpected error occurred while executing the request.';

    res.status(status).json({
      error: {
        code: errorCode,
        message: errorMessage
      },
      timeMs: err.timeMs
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
