import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from './db.js';

const SESSION_COOKIE_NAME = 'sentinel_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// In-memory rate limiter for login attempts (10 attempts per minute per IP)
const loginAttempts = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxAttempts = 10;

  const userAttempts = loginAttempts.get(ip) || [];
  const recentAttempts = userAttempts.filter((timestamp) => now - timestamp < windowMs);

  if (recentAttempts.length >= maxAttempts) {
    loginAttempts.set(ip, recentAttempts);
    return true;
  }

  recentAttempts.push(now);
  loginAttempts.set(ip, recentAttempts);
  return false;
}

/**
 * Creates a new session in the database and returns the session token.
 */
export function createSession(userId, req) {
  const token = crypto.randomBytes(32).toString('hex');
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const ipAddress = req.ip || req.socket?.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';

  const stmt = db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at, created_at, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(token, userId, expiresAt, createdAt, ipAddress, userAgent);

  return { token, expiresAt };
}

/**
 * Sets the secure session cookie on the response.
 */
export function setSessionCookie(res, token, expiresAt) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    expires: new Date(expiresAt),
    path: '/'
  });
}

/**
 * Clears the session cookie.
 */
export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/'
  });
}

/**
 * Retrieves the current user from a session token.
 */
export function getUserFromToken(token) {
  if (!token) return null;

  const stmt = db.prepare(`
    SELECT u.id, u.name, u.email, u.created_at, s.expires_at, s.token
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `);
  const row = stmt.get(token);

  if (!row) return null;

  // Check if session has expired
  if (new Date(row.expires_at) < new Date()) {
    // Delete expired session
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
    sessionToken: row.token
  };
}

/**
 * Middleware: Requires authentication.
 */
export function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE_NAME] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
  const user = getUserFromToken(token);

  if (!user) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to access this resource.'
      }
    });
  }

  req.user = user;
  next();
}

/**
 * Middleware: Optional authentication (attaches user if session is valid).
 */
export function optionalAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE_NAME] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
  const user = getUserFromToken(token);

  if (user) {
    req.user = user;
  }
  next();
}

/**
 * Registers auth routes on an Express router.
 */
export function setupAuthRoutes(router) {
  // POST /api/auth/register
  router.post('/auth/register', (req, res) => {
    const { name, email, password, confirmPassword } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        error: { code: 'INVALID_NAME', message: 'Name must be at least 2 characters long.' }
      });
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({
        error: { code: 'INVALID_EMAIL', message: 'Please provide a valid email address.' }
      });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        error: { code: 'INVALID_PASSWORD', message: 'Password must be at least 8 characters long.' }
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        error: { code: 'PASSWORD_MISMATCH', message: 'Password and confirm password do not match.' }
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    // Check if email already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(409).json({
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email address already exists. Please log in.'
        }
      });
    }

    const userId = crypto.randomUUID();
    const passwordHash = bcrypt.hashSync(password, 10);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, cleanName, cleanEmail, passwordHash, now, now);

    const { token, expiresAt } = createSession(userId, req);
    setSessionCookie(res, token, expiresAt);

    return res.status(201).json({
      user: {
        id: userId,
        name: cleanName,
        email: cleanEmail,
        createdAt: now
      },
      token,
      message: 'Registration successful.'
    });
  });

  // POST /api/auth/login
  router.post('/auth/login', (req, res) => {
    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
    if (isRateLimited(clientIp)) {
      return res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many login attempts. Please wait a minute before trying again.'
        }
      });
    }

    const { email, password } = req.body || {};

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        error: { code: 'MISSING_FIELDS', message: 'Email and password are required.' }
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);

    if (!user) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }
      });
    }

    const passwordMatches = bcrypt.compareSync(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }
      });
    }

    const { token, expiresAt } = createSession(user.id, req);
    setSessionCookie(res, token, expiresAt);

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.created_at
      },
      token,
      message: 'Login successful.'
    });
  });

  // POST /api/auth/logout
  router.post('/auth/logout', (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE_NAME] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
    if (token) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    clearSessionCookie(res);

    return res.json({
      success: true,
      message: 'Logged out successfully.'
    });
  });

  // GET /api/auth/me
  router.get('/auth/me', (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE_NAME] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
    const user = getUserFromToken(token);

    if (!user) {
      return res.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'No active session found.' }
      });
    }

    return res.json({
      user,
      token: token || user.sessionToken || null
    });
  });
}
