/**
 * API Sentinel - Main Client Logic
 * Coordinates HTTP execution, header management, assertion validation, and response rendering.
 */

(function () {
  'use strict';

  // DOM Elements
  const methodEl = document.getElementById('method');
  const urlEl = document.getElementById('url');
  const sendEl = document.getElementById('send');
  const exampleEl = document.getElementById('example');
  const headersEl = document.getElementById('headers');
  const addHeaderEl = document.getElementById('add-header');
  const bodyEl = document.getElementById('body');
  const errorEl = document.getElementById('error');
  const checkTypeEl = document.getElementById('check-type');
  const checkPathEl = document.getElementById('check-path');
  const checkExpectedEl = document.getElementById('check-expected');
  const addCheckEl = document.getElementById('add-check');
  const checkListEl = document.getElementById('check-list');
  const resultEl = document.getElementById('result');
  const statusEl = document.getElementById('status');
  const timeEl = document.getElementById('time');
  const sizeEl = document.getElementById('size');
  const summaryEl = document.getElementById('summary');
  const checkResultsEl = document.getElementById('check-results');
  const respBodyEl = document.getElementById('resp-body');
  const respHeadersEl = document.getElementById('resp-headers');
  const basicChecksEl = document.getElementById('basic-checks');
  const copyCurlEl = document.getElementById('copy-curl');

  // State
  let checks = [];

  // Helper: Format byte sizes
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    return (bytes / 1024).toFixed(1) + ' KB';
  }

  // Header Management
  function addHeaderRow(key = '', value = '') {
    const row = document.createElement('div');
    row.className = 'row header-row';
    row.innerHTML = `
      <input type="text" class="h-key" placeholder="Header Name" value="${key}" />
      <input type="text" class="h-value" placeholder="Header Value" value="${value}" />
      <button type="button" class="x" title="Remove Header" aria-label="Remove Header">✕</button>
    `;
    headersEl.appendChild(row);
  }

  if (addHeaderEl) {
    addHeaderEl.addEventListener('click', () => addHeaderRow());
  }

  if (headersEl) {
    headersEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('x')) {
        const row = e.target.closest('.header-row');
        if (row) row.remove();
      }
    });
  }

  function getHeadersObject() {
    const headers = {};
    const rows = headersEl.querySelectorAll('.header-row');
    rows.forEach((r) => {
      const k = r.querySelector('.h-key')?.value.trim();
      const v = r.querySelector('.h-value')?.value || '';
      if (k) headers[k] = v;
    });
    return headers;
  }

  // Check Management
  function renderChecksList() {
    if (!checkListEl) return;
    checkListEl.innerHTML = '';
    checks.forEach((c, idx) => {
      const chip = document.createElement('div');
      chip.className = 'row check-chip';
      const typeLabel = c.type.toUpperCase();
      const pathLabel = c.path ? ` [${c.path}]` : '';
      const expLabel = c.expected ? ` == "${c.expected}"` : '';
      chip.innerHTML = `
        <span class="check-desc"><strong>${typeLabel}</strong>${pathLabel}${expLabel}</span>
        <button type="button" class="x" data-index="${idx}" title="Remove Check" aria-label="Remove Check">✕</button>
      `;
      checkListEl.appendChild(chip);
    });
  }

  function addCheck(type, path, expected) {
    if (!type) return;
    checks.push({
      type: type.trim(),
      path: (path || '').trim(),
      expected: (expected || '').trim()
    });
    renderChecksList();
  }

  if (addCheckEl) {
    addCheckEl.addEventListener('click', () => {
      const type = checkTypeEl?.value || 'status';
      const path = checkPathEl?.value || '';
      const expected = checkExpectedEl?.value || '';
      addCheck(type, path, expected);
      if (checkPathEl) checkPathEl.value = '';
      if (checkExpectedEl) checkExpectedEl.value = '';
    });
  }

  if (checkListEl) {
    checkListEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('x')) {
        const idx = parseInt(e.target.dataset.index, 10);
        if (!isNaN(idx)) {
          checks.splice(idx, 1);
          renderChecksList();
        }
      }
    });
  }

  // Basic Checks Preset
  function addBasicChecks() {
    checks = [
      { type: 'status', path: '', expected: '200' },
      { type: 'json-valid', path: '', expected: '' },
      { type: 'time', path: '', expected: '2500' }
    ];
    renderChecksList();
  }

  if (basicChecksEl) {
    basicChecksEl.addEventListener('click', addBasicChecks);
  }

  // Example Preset
  function loadExample() {
    if (methodEl) methodEl.value = 'GET';
    if (urlEl) urlEl.value = 'https://jsonplaceholder.typicode.com/users/1';
    if (headersEl) headersEl.innerHTML = '';
    addHeaderRow('Accept', 'application/json');
    if (bodyEl) bodyEl.value = '';
    addBasicChecks();
    addCheck('field', 'id', '1');
    addCheck('field', 'email', '');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }
    // trigger method change event for ui.js
    if (methodEl) methodEl.dispatchEvent(new Event('change'));
  }

  if (exampleEl) {
    exampleEl.addEventListener('click', (e) => {
      e.preventDefault();
      loadExample();
    });
  }

  // Copy cURL Command
  function copyCurlCommand() {
    const method = methodEl ? methodEl.value : 'GET';
    const url = urlEl ? urlEl.value : '';
    const headers = getHeadersObject();
    const body = bodyEl ? bodyEl.value : '';

    let cmd = `curl -X ${method} "${url || 'https://api.example.com'}"`;
    Object.entries(headers).forEach(([k, v]) => {
      cmd += ` \\\n  -H "${k}: ${v}"`;
    });
    if (method !== 'GET' && body.trim()) {
      const escaped = body.replace(/"/g, '\\"');
      cmd += ` \\\n  -d "${escaped}"`;
    }

    navigator.clipboard.writeText(cmd).then(() => {
      if (copyCurlEl) {
        const orig = copyCurlEl.textContent;
        copyCurlEl.textContent = '✓ Copied cURL!';
        setTimeout(() => {
          copyCurlEl.textContent = orig;
        }, 2000);
      }
    });
  }

  if (copyCurlEl) {
    copyCurlEl.addEventListener('click', copyCurlCommand);
  }

  // Send Request Execution
  async function handleSend() {
    if (!urlEl || !sendEl) return;

    const url = urlEl.value.trim();
    const method = methodEl ? methodEl.value : 'GET';
    const headers = getHeadersObject();
    const body = bodyEl ? bodyEl.value : '';

    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }

    // Client-side URL validation
    if (!url) {
      if (errorEl) {
        errorEl.textContent = 'Target URL cannot be empty. Please enter an absolute HTTP/HTTPS URL.';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        if (errorEl) {
          errorEl.textContent = "Only 'http://' and 'https://' protocols are supported.";
          errorEl.classList.remove('hidden');
        }
        return;
      }
    } catch {
      if (errorEl) {
        errorEl.textContent = 'Malformed URL. Please enter a valid URL (e.g. https://api.example.com/data).';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    // Client-side JSON body check
    if (method !== 'GET' && body.trim()) {
      try {
        JSON.parse(body);
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = `Invalid JSON payload: ${err.message}`;
          errorEl.classList.remove('hidden');
        }
        return;
      }
    }

    // Set Loading state
    sendEl.disabled = true;
    const originalSendText = sendEl.innerHTML;
    sendEl.innerHTML = '<span class="spinner-sm"></span> Sending...';

    const startTime = performance.now();

    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          method,
          headers,
          body: method !== 'GET' ? body : ''
        })
      });

      const data = await res.json();
      const elapsed = Math.round(performance.now() - startTime);

      if (data.error) {
        if (errorEl) {
          errorEl.textContent = `[${data.error.code || 'ERROR'}] ${data.error.message || 'Execution failed.'}`;
          errorEl.classList.remove('hidden');
        }
        if (resultEl) {
          resultEl.setAttribute('hidden', '');
        }
      } else {
        // Successful response received
        renderResponse(data, elapsed);
      }
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = `Network / connection error: ${err.message}. Ensure the API Sentinel backend is active.`;
        errorEl.classList.remove('hidden');
      }
      if (resultEl) {
        resultEl.setAttribute('hidden', '');
      }
    } finally {
      sendEl.disabled = false;
      sendEl.innerHTML = originalSendText;
    }
  }

  function renderResponse(data, elapsed) {
    if (!resultEl) return;

    // Reveal results section
    resultEl.removeAttribute('hidden');

    const statusNum = data.status || 200;
    const statusText = data.statusText || 'OK';

    // Status pill class: good / warn / bad / info
    let pillClass = 'good';
    if (statusNum >= 200 && statusNum < 300) {
      pillClass = 'good';
    } else if (statusNum >= 300 && statusNum < 400) {
      pillClass = 'info';
    } else if (statusNum >= 400 && statusNum < 500) {
      pillClass = 'warn';
    } else {
      pillClass = 'bad';
    }

    if (statusEl) {
      statusEl.className = `pill ${pillClass}`;
      statusEl.textContent = `${statusNum} ${statusText}`;
    }

    if (timeEl) {
      timeEl.textContent = `${data.timeMs !== undefined ? data.timeMs : elapsed} ms`;
    }

    if (sizeEl) {
      sizeEl.textContent = formatBytes(data.sizeBytes || 0);
    }

    // Response body formatting
    if (respBodyEl) {
      let bodyFormatted = data.body || '';
      try {
        const parsed = JSON.parse(data.body);
        bodyFormatted = JSON.stringify(parsed, null, 2);
      } catch {}
      respBodyEl.textContent = bodyFormatted || '(Empty response body)';
    }

    // Response headers formatting
    if (respHeadersEl) {
      const hObj = data.headers || {};
      const hLines = Object.entries(hObj).map(([k, v]) => `${k}: ${v}`);
      respHeadersEl.textContent = hLines.length > 0 ? hLines.join('\n') : '(No response headers)';
    }

    // Run pass/fail checks using Validator
    if (window.Validator && checkResultsEl && summaryEl) {
      const report = window.Validator.runChecks(
        {
          status: statusNum,
          timeMs: data.timeMs !== undefined ? data.timeMs : elapsed,
          headers: data.headers || {},
          body: data.body || ''
        },
        checks
      );

      checkResultsEl.innerHTML = '';
      report.results.forEach((r) => {
        const li = document.createElement('li');
        li.className = r.passed ? 'pass' : 'fail';
        li.innerHTML = `
          <div class="check-result-header">
            <span class="check-tag ${r.passed ? 'pass' : 'fail'}">${r.passed ? 'PASS' : 'FAIL'}</span>
            <span class="check-title">${r.type.toUpperCase()}${r.path ? ` [${r.path}]` : ''}</span>
          </div>
          <div class="check-diff">
            <span>expected: <code>${r.expected}</code></span>
            <span>actual: <code>${r.actual}</code></span>
          </div>
          ${!r.passed && r.explanation ? `<div class="check-explanation">${r.explanation}</div>` : ''}
        `;
        checkResultsEl.appendChild(li);
      });

      if (report.total === 0) {
        summaryEl.className = 'summary info';
        summaryEl.innerHTML = '<span>No checks configured. Add checks above to validate response.</span>';
      } else if (report.failed === 0) {
        summaryEl.className = 'summary good';
        summaryEl.innerHTML = `<span>✓ All ${report.total} checks passed (100%)</span>`;
      } else {
        const pct = Math.round((report.passed / report.total) * 100);
        summaryEl.className = 'summary bad';
        summaryEl.innerHTML = `<span>✗ ${report.failed} of ${report.total} checks failed (${pct}% pass rate)</span>`;
      }
    }
  }

  if (sendEl) {
    sendEl.addEventListener('click', handleSend);
  }

  if (urlEl) {
    urlEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    });
  }

  // Initial setup: add one empty header row and default basic checks
  addHeaderRow('Accept', 'application/json');
  addBasicChecks();
})();
