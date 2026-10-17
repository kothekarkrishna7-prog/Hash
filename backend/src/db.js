import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure the data directory exists
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'sentinel.db');

export const db = new DatabaseSync(DB_PATH);

// Enable WAL mode and foreign keys for high performance and integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Initializes database tables and indexes if they do not exist.
 */
export function initDatabase() {
  db.exec(`
    -- Users Table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Sessions Table for secure cookie-based session management
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Request History Table
    CREATE TABLE IF NOT EXISTS request_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      url TEXT NOT NULL,
      method TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      status_code INTEGER,
      status_text TEXT,
      time_ms INTEGER,
      execution_result TEXT NOT NULL,
      total_checks INTEGER DEFAULT 0,
      passed_checks INTEGER DEFAULT 0,
      failed_checks INTEGER DEFAULT 0,
      expected_status INTEGER,
      request_headers TEXT,
      request_body TEXT,
      response_headers TEXT,
      response_body TEXT,
      size_bytes INTEGER DEFAULT 0,
      error_message TEXT,
      error_code TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Indexes for fast queries
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_history_user_id ON request_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_history_timestamp ON request_history(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_history_method ON request_history(method);
    CREATE INDEX IF NOT EXISTS idx_history_result ON request_history(execution_result);
  `);

  console.log(`[Database] SQLite database initialized at ${DB_PATH}`);
}

// Auto-initialize on import
initDatabase();
