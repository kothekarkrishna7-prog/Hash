# API Sentinel 🛡️

> **API Sentinel** is a lightweight, modern web-based developer tool designed to quickly send HTTP requests to public APIs, inspect responses, and run deterministic automated validation checks with instant pass/fail summaries.

Built according to the **API Sentinel Product Requirements Document (PRD)** within a 5-hour constraint.

---

## 🌟 Key Features

1. **Request Builder (FR-01 to FR-08)**:
   - Supports `GET`, `POST`, `PUT`, `PATCH`, and `DELETE`.
   - Dynamic headers editor with quick-add helpers (`Content-Type`, `Accept`, `Authorization`).
   - JSON Body editor with client-side syntax validation before dispatch (disabled for `GET`).
   - `Enter`-to-send in URL field and anti-duplicate submission protection.
   - Quick "Load Example" presets for 1-click verification of GET, POST, 404, and Security tests.

2. **Secure Request Execution Proxy (FR-09 to FR-16, SEC-01 to SEC-17)**:
   - Outbound requests routed through Node.js backend using native `fetch`.
   - Comprehensive SSRF protection (`ssrfGuard.js`):
     - Blocks loopback (`127.0.0.0/8`, `::1`), private ranges (RFC 1918), carrier-grade NAT (RFC 6598), IPv6 unique-local/link-local, IPv4-mapped IPv6, and cloud metadata (`169.254.169.254`).
     - Pre-request DNS resolution checking all resolved addresses.
     - Safe redirect following (max 3 hops, re-checking SSRF at every hop).
     - Fixed 15-second timeout and 1 MB response payload memory cap.
     - Safe, secret-free error messages without leaking stack traces or internal topology.

3. **Response Viewer (FR-17 to FR-22)**:
   - Color-coded HTTP status badge (`2xx` success, `3xx` redirect, `4xx` client error, `5xx` server error) with explicit text labels.
   - Millisecond-accurate round-trip latency (`⚡ Time`) and payload size (`📦 Size`).
   - Pretty-printed JSON with token syntax highlighting and copy-to-clipboard.
   - Plain text fallback and explicit empty-body notice.
   - Comprehensive response headers inspector.

4. **Validation Engine & Test Summary (FR-23 to FR-36, Section 12)**:
   - Expected status code equality check (`100` to `599`).
   - JSON syntax validity toggle (`requireValidJson`).
   - Required top-level JSON fields tag manager (exact case-sensitive match on objects; supports keys with null/empty values).
   - Max response time latency threshold check (`maxTimeMs`).
   - **Reactive re-validation (FR-28)**: Changing assertions updates the test summary immediately in the browser without re-sending the request.
   - Pass/fail summary cards, percentage gauge, and clear distinction between execution failures vs assertion failures.

---

## 📁 Project Structure

```
API sentinel Project/
├── PRD.md                       # Product Requirements Document
├── package.json                 # Monorepo runner scripts
├── README.md                    # Project documentation & runbook
├── tests/
│   └── e2eTest.js               # Acceptance Criteria test suite (AC-01 to AC-20)
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── server.js            # Express server (CORS, /health, /api/send)
│   │   ├── ssrfGuard.js         # IP blocking, DNS check, header sanitization
│   │   └── requestExecutor.js   # Outbound fetch, timing, redirect & size limits
│   └── tests/
│       └── verifyBackend.js     # SSRF & backend integration tests
└── frontend/
    ├── package.json
    ├── index.html               # App entry with Inter & JetBrains Mono fonts
    ├── vite.config.js
    ├── testValidation.js        # Pure validation engine test suite
    └── src/
        ├── main.jsx
        ├── App.jsx              # Main application orchestrator
        ├── index.css            # Dark Cyber/Sentinel CSS design system
        ├── components/
        │   ├── Header.jsx       # Branding, health pulse & preset loader
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
Clone or navigate to the workspace directory:
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
To run the full stack locally:
1. **Start the Backend** (runs on `http://localhost:3001`):
   ```bash
   node backend/src/server.js
   ```
2. **Start the Frontend** (runs on `http://localhost:5173`):
   ```bash
   cd frontend
   npm run dev
   ```
3. Open your browser at `http://localhost:5173`.

---

## 🧪 Automated Testing

Run the automated test suites to verify all security guards, validation rules, and acceptance criteria:

```bash
# Run backend SSRF and proxy execution tests
npm run test:backend

# Run pure validation engine tests (PRD Section 12)
npm run test:frontend

# Run full Acceptance Criteria suite (AC-01 to AC-20)
npm run test
```

---

## 🔒 Security Disclosure (SEC-14.3)

API Sentinel implements destination blocking, DNS resolution inspection, and hop-by-hop header stripping to mitigate SSRF and proxy abuse. This protection is designed for hackathon demonstrations and developer tools, and is not a certified military-grade security boundary. Testing private or internal intranet endpoints is intentionally blocked by design.

---

## 📄 License
MIT License. Created for the API Sentinel Project.
