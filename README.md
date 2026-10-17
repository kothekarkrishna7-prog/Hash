
# API Sentinel PRO 🛡️

> **API Sentinel PRO** is a lightweight, modern web-based developer tool designed to quickly send HTTP requests to public APIs, inspect responses, run deterministic automated validation checks with instant pass/fail summaries, and manage persistent request history with user authentication and profile metrics.

---

## 🌟 Key Features

### 1. User Authentication & Session Security
- **Registration & Login**: Secure account creation and login with form validation, password visibility toggles, and duplicate email prevention.
- **Cookie-Based Sessions**: Server-issued `HttpOnly` sessions with `SameSite` and `Secure` attributes, preventing token leakage or localStorage attacks.
- **Password Security**: Passwords hashed using `bcrypt` (10 rounds). Plaintext passwords are never stored or exposed.
- **Brute Force Protection**: IP-based rate limiting on authentication endpoints.
- **Session Revocation**: Logout instantly invalidates session tokens in the database.

### 2. API Request History
- **Automatic Logging**: Every request executed by an authenticated user is automatically persisted in SQLite, including failed executions, network errors, and timeouts.
- **Sensitive Data Redaction**: Automatic redaction of secrets, `Authorization` headers, cookies, API keys, and sensitive payload fields before persistence (`sanitizer.js`).
- **Search & Multi-Filter**: Real-time search by endpoint URL, filtering by HTTP method (`GET`, `POST`, etc.), HTTP status code (`2xx`, `4xx`, `5xx`), and date ranges.
- **Deep Inspection**: View complete request headers, request bodies, response headers, response bodies, and assertion summaries.
- **1-Click Rerun**: Pre-populates the API Tester with the exact historical configuration for instant re-execution.
- **IDOR Protection**: Strictly scoped database queries prevent cross-user data leakage.

### 3. User Profile & Dashboard Statistics
- **Live Statistics**: Aggregated from real database records:
  - Total API requests executed
  - Successful HTTP responses (2xx/3xx)
  - Failed executions (client errors, server errors, timeouts, network issues)
  - Assertion validation pass rate percentage
- **Account Management**: Update display name, change password with current password verification, and optional account deletion with confirmation.
- **Dashboard Overview**: Summary cards and recent test activity table with quick rerun actions.

### 4. Request Builder & Response Viewer (Core Engine)
- Supports `GET`, `POST`, `PUT`, `PATCH`, and `DELETE`.
- Headers manager and JSON body editor with client-side syntax checks.
- Color-coded HTTP status badges, round-trip latency (`ms`), and payload sizes.
- Formatted JSON viewer with color syntax highlighting and copy-to-clipboard.
- SSRF and IP blocking guard (`ssrfGuard.js`) protecting against loopback, private RFC 1918, carrier NAT, and cloud metadata (`169.254.169.254`).

### 5. Deterministic Validation Engine (PRD Section 12)
- HTTP status equality (`100` to `599`).
- JSON syntax validity toggle.
- Required top-level JSON fields (exact case-sensitive match; supports keys with null/empty values).
- Max response time threshold (`ms`).
- **Reactive Re-Validation**: Adjusting assertions instantly re-calculates the test summary without re-fetching.

---

## 📁 Project Structure

```
API sentinel Project/
├── PRD.md                       # Product Requirements Document
├── package.json                 # Monorepo runner scripts
├── README.md                    # Project documentation & runbook
├── tests/
│   ├── e2eTest.js               # Acceptance Criteria test suite (AC-01 to AC-20)
│   └── fullUpgradeTest.js       # Complete 22-point Upgrade Acceptance Suite
├── backend/
│   ├── package.json
│   ├── data/
│   │   └── sentinel.db          # SQLite persistent database (auto-created)
│   ├── src/
│   │   ├── server.js            # Express server (CORS, /health, /api/send)
│   │   ├── db.js                # SQLite database setup (users, sessions, history)
│   │   ├── auth.js              # Auth routes, session cookies, bcrypt hashing
│   │   ├── userRoutes.js        # Profile, password change, stats routes
│   │   ├── historyRoutes.js     # Paginated history, search, rerun, delete
│   │   ├── sanitizer.js         # Header & credential redaction
│   │   ├── ssrfGuard.js         # IP blocking, DNS check, header sanitization
│   │   └── requestExecutor.js   # Outbound fetch, timing, redirect & size limits
│   └── tests/
│       ├── verifyBackend.js     # SSRF & backend integration tests
│       └── testAuthAndHistory.js # Auth, profile, and history integration tests
└── frontend/
    ├── package.json
    ├── index.html               # App entry with Inter & JetBrains Mono fonts
    ├── vite.config.js
    ├── testValidation.js        # Pure validation engine test suite
    └── src/
        ├── main.jsx             # React root with AuthProvider
        ├── App.jsx              # Application router & orchestrator
        ├── index.css            # Dark Cyber/Sentinel CSS design system
        ├── context/
        │   └── AuthContext.jsx  # Authentication state & session manager
        ├── components/
        │   ├── Header.jsx       # Navigation tabs, user profile badge, health pulse
        │   ├── DashboardView.jsx # Summary cards, recent activity, quick actions
        │   ├── HistoryView.jsx  # Search, filters, history table & pagination
        │   ├── HistoryDetailModal.jsx # Deep inspection modal & rerun trigger
        │   ├── ProfileView.jsx  # User profile, edit name, change password
        │   ├── AuthModal.jsx    # Login & Register modal with password toggles
        │   ├── RequestBuilder.jsx # Method, URL, headers & body editor
        │   ├── ValidationConfig.jsx # Expected status, JSON switch, fields
        │   ├── ResponseViewer.jsx # Overview, syntax-highlighted viewer, tabs
        │   └── TestSummary.jsx  # Banner, metrics grid & assertion cards
        └── utils/
            ├── validationEngine.js # Pure PRD Section 12 validation logic
            └── jsonHighlighter.js # Colored HTML token generator for JSON
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ or v24+ recommended)
- npm (v9+)

### Installation
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
```

### Running Locally
1. **Start the Backend** (runs on `http://localhost:3001`):
   ```bash
   npm run backend
   ```
2. **Start the Frontend** (runs on `http://localhost:5173`):
   ```bash
   npm run frontend
   ```
3. Open your browser at `http://localhost:5173`.

---

## 🧪 Automated Testing

Run the automated test suites covering all security guards, authentication, history, and acceptance criteria:

```bash
# 1. Run core backend SSRF and proxy execution tests
npm run test:backend

# 2. Run pure validation engine tests (PRD Section 12)
npm run test:frontend

# 3. Run auth, session, and history integration tests
npm run test:auth

# 4. Run the complete 22-point Upgrade Acceptance Criteria suite
npm run test:upgrade

# 5. Build frontend bundle for production verification
npm run build
```

---

## 🔒 Security Configuration & Environment Variables

| Variable | Default | Purpose |

| `PORT` | `3001` | Backend port |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin for credentials |
| `NODE_ENV` | `development` | In `production`, enforces `Secure` cookies and strict headers |
| `DB_PATH` | `backend/data/sentinel.db` | Custom location for the SQLite database file |



## 📄 License
MIT License. Created for the API Sentinel Project.

# Hash
 3b4e5536f1814c53dd2df56dfcedd48c45fb32e5

# Hash
8907c53611dc8946a0804174199fd60e795128a6
