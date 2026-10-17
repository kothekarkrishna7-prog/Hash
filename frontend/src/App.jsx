import React, { useState, useMemo, useRef, useEffect } from 'react';
import Header, { PRESETS } from './components/Header.jsx';
import RequestBuilder from './components/RequestBuilder.jsx';
import ValidationConfig from './components/ValidationConfig.jsx';
import ResponseViewer from './components/ResponseViewer.jsx';
import TestSummary from './components/TestSummary.jsx';
import { runValidation } from './utils/validationEngine.js';

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default function App() {
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
    setUrlError('');
    setBodyError('');
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
        body: JSON.stringify({
          url: trimmedUrl,
          method,
          headers: headersObject,
          body: method !== 'GET' ? body : ''
        })
      });

      clearInterval(timerRef.current);
      const data = await res.json();

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

  return (
    <div className="app-container">
      <Header
        backendUrl={BACKEND_URL}
        onSelectPreset={handleSelectPreset}
        onReset={handleReset}
      />

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

      <footer className="app-footer">
        <div>
          <strong>API Sentinel</strong> — Engineered for fast, secure API verification and assertion testing.
        </div>
        <div>
          Compliant with SSRF protection RFCs • Native Node.js Fetch Execution • Deterministic Browser Validation
        </div>
      </footer>
    </div>
  );
}
