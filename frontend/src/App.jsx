import React, { useState, useMemo, useRef, useEffect } from 'react';
import Header from './components/Header.jsx';
import RequestBuilder from './components/RequestBuilder.jsx';
import ValidationConfig from './components/ValidationConfig.jsx';
import ResponseViewer from './components/ResponseViewer.jsx';
import TestSummary from './components/TestSummary.jsx';
import DashboardView from './components/DashboardView.jsx';
import HistoryView from './components/HistoryView.jsx';
import ProfileView from './components/ProfileView.jsx';
import AuthModal from './components/AuthModal.jsx';
import { runValidation } from './utils/validationEngine.js';
import { useAuth } from './context/AuthContext.jsx';

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default function App() {
  const { isAuthenticated } = useAuth();

  // Navigation Tab: 'dashboard' | 'tester' | 'history' | 'profile'
  const [activeTab, setActiveTab] = useState('tester');

  // Auth Modal state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');

  // Request Configuration State
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('https://jsonplaceholder.typicode.com/users/1');
  const [headers, setHeaders] = useState([
    { key: 'Accept', value: 'application/json' }
  ]);
  const [body, setBody] = useState('');

  // Validation Configuration State
  const [expectedStatus, setExpectedStatus] = useState('200');
  const [requireValidJson, setRequireValidJson] = useState(true);
  const [requiredFields, setRequiredFields] = useState(['id', 'name', 'username', 'email']);
  const [maxTimeMs, setMaxTimeMs] = useState('2500');

  // Execution State
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [executionError, setExecutionError] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [currentHistoryId, setCurrentHistoryId] = useState(null);

  // Validation errors for inputs
  const [urlError, setUrlError] = useState('');
  const [bodyError, setBodyError] = useState('');

  const timerRef = useRef(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Reactive Validation Report (FR-28)
  const validationReport = useMemo(() => {
    if (!response) return null;
    return runValidation(response, {
      expectedStatus,
      requireValidJson,
      requiredFields,
      maxTimeMs
    });
  }, [response, expectedStatus, requireValidJson, requiredFields, maxTimeMs]);

  // Sync validation updates to history record if one exists
  useEffect(() => {
    if (currentHistoryId && validationReport && isAuthenticated) {
      fetch(`${BACKEND_URL}/api/history/${currentHistoryId}/validation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          totalChecks: validationReport.total,
          passedChecks: validationReport.passed,
          failedChecks: validationReport.failed,
          expectedStatus: expectedStatus ? parseInt(expectedStatus, 10) : null
        })
      }).catch(() => {
        // non-blocking
      });
    }
  }, [currentHistoryId, validationReport, expectedStatus, isAuthenticated]);

  // Open Auth Modal helper
  const handleOpenAuthModal = (mode = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  // Load Example Preset (FR-07)
  const handleSelectPreset = (preset) => {
    setUrl(preset.url);
    setMethod(preset.method);
    setHeaders(preset.headers || []);
    setBody(preset.body || '');
    setExpectedStatus(preset.expectedStatus !== undefined ? String(preset.expectedStatus) : '');
    setRequireValidJson(Boolean(preset.requireValidJson));
    setRequiredFields(preset.requiredFields || []);
    setMaxTimeMs(preset.maxTimeMs ? String(preset.maxTimeMs) : '');
    setUrlError('');
    setBodyError('');
  };

  // Reset form
  const handleReset = () => {
    setUrl('');
    setMethod('GET');
    setHeaders([]);
    setBody('');
    setExpectedStatus('');
    setRequireValidJson(false);
    setRequiredFields([]);
    setMaxTimeMs('');
    setResponse(null);
    setExecutionError(null);
    setCurrentHistoryId(null);
    setUrlError('');
    setBodyError('');
  };

  // Rerun a historical request in the API Tester
  const handleRerunRequest = (historyRecord) => {
    setUrl(historyRecord.url);
    setMethod(historyRecord.method);

    let parsedHeaders = [];
    if (historyRecord.request_headers) {
      if (typeof historyRecord.request_headers === 'object') {
        parsedHeaders = Object.entries(historyRecord.request_headers).map(([key, value]) => ({ key, value }));
      } else {
        try {
          const parsed = JSON.parse(historyRecord.request_headers);
          parsedHeaders = Object.entries(parsed).map(([key, value]) => ({ key, value }));
        } catch {}
      }
    }
    setHeaders(parsedHeaders);
    setBody(historyRecord.request_body || '');
    setExpectedStatus(historyRecord.expected_status ? String(historyRecord.expected_status) : '');
    setResponse(null);
    setExecutionError(null);
    setCurrentHistoryId(null);
    setUrlError('');
    setBodyError('');

    // Switch to tester tab
    setActiveTab('tester');
  };

  // Handle URL change with smart field suggestions
  const handleUrlChange = (newUrl) => {
    setUrl(newUrl);
    // If user changes to a users endpoint and had posts fields, switch intelligently
    if (newUrl.includes('/users') && requiredFields.includes('title')) {
      setRequiredFields(['id', 'name', 'username', 'email']);
    } else if (newUrl.includes('/posts') && requiredFields.includes('username')) {
      setRequiredFields(['id', 'title', 'userId']);
    }
  };

  // Send Request (FR-05, FR-06, FR-09, FR-10, AC-17, AC-18)
  const handleSend = async () => {
    if (isLoading) return; // Prevent duplicate submission

    // 1. Client-side input validation (FR-05)
    let hasError = false;
    setUrlError('');
    setBodyError('');

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setUrlError('Target URL cannot be empty. Please enter an absolute HTTP or HTTPS URL.');
      hasError = true;
    } else {
      try {
        const parsed = new URL(trimmedUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          setUrlError("Invalid URL protocol. Only 'http://' and 'https://' are supported.");
          hasError = true;
        }
      } catch {
        setUrlError('Malformed URL. Please enter a valid URL (e.g. https://api.example.com/data).');
        hasError = true;
      }
    }

    if (method !== 'GET' && body.trim().length > 0) {
      try {
        JSON.parse(body);
      } catch (err) {
        setBodyError(`Invalid JSON in request body: ${err.message}`);
        hasError = true;
      }
    }

    if (hasError) return;

    // 2. Prepare request payload
    const headersObject = {};
    headers.forEach((h) => {
      const k = h.key.trim();
      if (k) {
        headersObject[k] = h.value;
      }
    });

    // 3. Initiate request
    setIsLoading(true);
    setResponse(null);
    setExecutionError(null);
    setElapsedMs(0);
    setCurrentHistoryId(null);

    const startTime = performance.now();
    timerRef.current = setInterval(() => {
      setElapsedMs(Math.round(performance.now() - startTime));
    }, 50);

    try {
      const res = await fetch(`${BACKEND_URL}/api/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Sends HttpOnly session cookie
        body: JSON.stringify({
          url: trimmedUrl,
          method,
          headers: headersObject,
          body: method !== 'GET' ? body : '',
          expectedStatus: expectedStatus ? parseInt(expectedStatus, 10) : null
        })
      });

      clearInterval(timerRef.current);
      const data = await res.json();

      if (data.historyId) {
        setCurrentHistoryId(data.historyId);
      }

      if (data.error) {
        // Request Execution Failure (FR-13, FR-14, FR-21, FR-34)
        setExecutionError(data.error);
        setResponse(null);
      } else {
        // Target response received (FR-11, FR-12)
        setResponse(data);
        setExecutionError(null);
      }
    } catch (err) {
      clearInterval(timerRef.current);
      setExecutionError({
        code: 'PROXY_COMMUNICATION_ERROR',
        message: `Failed to connect to API Sentinel backend at ${BACKEND_URL}: ${err.message}. Ensure the backend service is running.`
      });
      setResponse(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <Header
        backendUrl={BACKEND_URL}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuthModal={handleOpenAuthModal}
        onSelectPreset={handleSelectPreset}
        onReset={handleReset}
      />

      {/* View 1: Dashboard */}
      {activeTab === 'dashboard' && (
        <DashboardView
          backendUrl={BACKEND_URL}
          onNavigateToTester={() => setActiveTab('tester')}
          onNavigateToHistory={() => {
            if (!isAuthenticated) handleOpenAuthModal('login');
            else setActiveTab('history');
          }}
          onRerunRequest={handleRerunRequest}
        />
      )}

      {/* View 2: API Tester (Full original functionality preserved) */}
      {activeTab === 'tester' && (
        <main className="main-layout">
          {/* Left Column: Request Builder & Validation Rules */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <RequestBuilder
              method={method}
              setMethod={setMethod}
              url={url}
              setUrl={handleUrlChange}
              headers={headers}
              setHeaders={setHeaders}
              body={body}
              setBody={setBody}
              onSend={handleSend}
              isLoading={isLoading}
              urlError={urlError}
              bodyError={bodyError}
            />

            <ValidationConfig
              expectedStatus={expectedStatus}
              setExpectedStatus={setExpectedStatus}
              requireValidJson={requireValidJson}
              setRequireValidJson={setRequireValidJson}
              requiredFields={requiredFields}
              setRequiredFields={setRequiredFields}
              maxTimeMs={maxTimeMs}
              setMaxTimeMs={setMaxTimeMs}
              response={response}
            />
          </div>

          {/* Right Column: Response Viewer & Test Summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <ResponseViewer
              response={response}
              executionError={executionError}
              isLoading={isLoading}
              elapsedMs={elapsedMs}
            />

            <TestSummary
              validationReport={validationReport}
              hasResponse={Boolean(response)}
              executionError={executionError}
              onRemoveField={(fieldToRemove) =>
                setRequiredFields(requiredFields.filter((f) => f !== fieldToRemove))
              }
            />
          </div>
        </main>
      )}

      {/* View 3: History */}
      {activeTab === 'history' && (
        <HistoryView
          backendUrl={BACKEND_URL}
          onRerunRequest={handleRerunRequest}
          onNavigateToTester={() => setActiveTab('tester')}
        />
      )}

      {/* View 4: Profile */}
      {activeTab === 'profile' && (
        <ProfileView
          backendUrl={BACKEND_URL}
          onNavigateToTester={() => setActiveTab('tester')}
        />
      )}

      {/* Authentication Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />

      <footer className="app-footer">
        <div>
          <strong>API Sentinel PRO</strong> — Engineered for fast, secure API verification, automated assertion testing, and persistent history logging.
        </div>
        <div>
          SQLite Persistent Storage • Secure HttpOnly Sessions • SSRF Protection RFCs • Deterministic Browser Validation
        </div>
      </footer>
    </div>
  );
}
