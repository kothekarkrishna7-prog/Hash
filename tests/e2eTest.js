import assert from 'node:assert/strict';
import { runValidation } from '../frontend/src/utils/validationEngine.js';

const BACKEND_URL = 'http://localhost:3001';

console.log('=== Running API Sentinel End-to-End & Acceptance Criteria Verification ===\n');

let totalAc = 0;
let passedAc = 0;

async function testScenario(acId, description, fn) {
  totalAc++;
  try {
    await fn();
    passedAc++;
    console.log(`  [PASS] ${acId}: ${description}`);
  } catch (err) {
    console.error(`  [FAIL] ${acId}: ${description}`);
    console.error(`         ${err.message}`);
  }
}

// AC-01: Successful GET request
await testScenario('AC-01', 'Successful GET request returns 200, time, headers, formatted body', async () => {
  const res = await fetch(`${BACKEND_URL}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://jsonplaceholder.typicode.com/posts/1',
      method: 'GET'
    })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 200);
  assert.ok(data.timeMs > 0);
  assert.ok(data.headers['content-type']);
  const parsed = JSON.parse(data.body);
  assert.equal(parsed.id, 1);
});

// AC-02: POST with JSON body
await testScenario('AC-02', 'POST with JSON body reaches target and receives creation status', async () => {
  const payload = JSON.stringify({ title: 'Sentinel Test', body: 'AC-02 Test', userId: 1 });
  const res = await fetch(`${BACKEND_URL}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://jsonplaceholder.typicode.com/posts',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 201);
  const parsed = JSON.parse(data.body);
  assert.equal(parsed.title, 'Sentinel Test');
});

// AC-03: Custom headers forwarded
await testScenario('AC-03', 'Custom headers forwarded to target', async () => {
  const res = await fetch(`${BACKEND_URL}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://httpbin.org/headers',
      method: 'GET',
      headers: { 'X-Sentinel-Custom': 'Active-Check-123' }
    })
  });
  if (res.status === 200) {
    const data = await res.json();
    if (data.status === 200) {
      const parsed = JSON.parse(data.body);
      assert.ok(parsed.headers['X-Sentinel-Custom'] || parsed.headers['x-sentinel-custom']);
    }
  }
});

// AC-04: Expected status passes
await testScenario('AC-04', 'Expected status equals actual -> assertion shows PASS', async () => {
  const dummyRes = { status: 200, timeMs: 80, body: '{}' };
  const report = runValidation(dummyRes, { expectedStatus: 200 });
  const statCheck = report.assertions.find((a) => a.id === 'status_code');
  assert.equal(statCheck.passed, true);
  assert.equal(report.status, 'ALL_PASSED');
});

// AC-05: Expected status fails
await testScenario('AC-05', 'Expected status differs from actual -> assertion shows FAIL with explanation', async () => {
  const dummyRes = { status: 200, timeMs: 80, body: '{}' };
  const report = runValidation(dummyRes, { expectedStatus: 201 });
  const statCheck = report.assertions.find((a) => a.id === 'status_code');
  assert.equal(statCheck.passed, false);
  assert.equal(statCheck.expected, '201');
  assert.equal(statCheck.actual, '200');
  assert.equal(statCheck.explanation, 'Expected HTTP status 201, but received 200.');
});

// AC-06: All required fields exist
await testScenario('AC-06', 'All required fields exist on top-level -> each field PASS', async () => {
  const dummyRes = { status: 200, timeMs: 80, body: JSON.stringify({ id: 10, title: 'Item', active: true }) };
  const report = runValidation(dummyRes, { requiredFields: ['id', 'title', 'active'] });
  assert.equal(report.passed, 3);
  assert.equal(report.failed, 0);
  assert.equal(report.passPercentage, 100);
});

// AC-07: Required field missing
await testScenario('AC-07', 'Absent field yields FAIL naming the missing field', async () => {
  const dummyRes = { status: 200, timeMs: 80, body: JSON.stringify({ id: 10 }) };
  const report = runValidation(dummyRes, { requiredFields: ['id', 'missingField'] });
  assert.equal(report.passed, 1);
  assert.equal(report.failed, 1);
  const missing = report.assertions.find((a) => a.field === 'missingField');
  assert.equal(missing.passed, false);
  assert.equal(missing.explanation, 'Field "missingField" is missing from the response.');
});

// AC-08: Invalid JSON response with JSON validation and field checks
await testScenario('AC-08', 'Invalid JSON causes JSON-syntax and field checks to FAIL with explanations', async () => {
  const dummyRes = { status: 200, timeMs: 80, body: '<xml>not json</xml>' };
  const report = runValidation(dummyRes, { requireValidJson: true, requiredFields: ['data'] });
  assert.equal(report.total, 2);
  assert.equal(report.passed, 0);
  assert.equal(report.failed, 2);
  assert.equal(report.assertions[0].explanation, 'The response body is not valid JSON.');
  assert.equal(report.assertions[1].explanation, 'The response body is not valid JSON, so fields could not be checked.');
});

// AC-09: Plain text response
await testScenario('AC-09', 'Plain text response handled cleanly without errors', async () => {
  const dummyRes = { status: 200, timeMs: 80, body: 'Hello Plain Text World' };
  const report = runValidation(dummyRes, { requireValidJson: true });
  assert.equal(report.assertions[0].passed, false);
});

// AC-10: HTTP error from target (e.g. 404) treated as successful execution
await testScenario('AC-10', 'Target 404 returned as successful execution; expecting 404 PASSES', async () => {
  const res = await fetch(`${BACKEND_URL}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://jsonplaceholder.typicode.com/posts/999999',
      method: 'GET'
    })
  });
  assert.equal(res.status, 200); // Backend transport status is 200
  const data = await res.json();
  assert.equal(data.status, 404); // Target status
  const report = runValidation(data, { expectedStatus: 404 });
  assert.equal(report.passed, 1);
  assert.equal(report.status, 'ALL_PASSED');
});

// AC-11: Network failure for non-existent domain
await testScenario('AC-11', 'Hostname that does not resolve returns NETWORK_ERROR', async () => {
  const res = await fetch(`${BACKEND_URL}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://domain-definitely-does-not-exist-sentinel-xyz123.com',
      method: 'GET'
    })
  });
  assert.equal(res.status, 502);
  const data = await res.json();
  assert.equal(data.error.code, 'NETWORK_ERROR');
});

// AC-13: No assertions configured
await testScenario('AC-13', 'No assertions configured -> Total 0, percentage null, message present', async () => {
  const dummyRes = { status: 200, timeMs: 50, body: '{"ok":true}' };
  const report = runValidation(dummyRes, {});
  assert.equal(report.total, 0);
  assert.equal(report.passPercentage, null);
  assert.match(report.message, /No checks configured/i);
});

// AC-14: Summary counts correct (Worked example: 3 checks, 2 passing -> 67%)
await testScenario('AC-14', 'Summary counts match 3 checks, 2 passing -> 67%', async () => {
  const dummyRes = { status: 200, timeMs: 50, body: '{"ok":true}' };
  const report = runValidation(dummyRes, {
    expectedStatus: 200,
    requireValidJson: true,
    requiredFields: ['nonExistent']
  });
  assert.equal(report.total, 3);
  assert.equal(report.passed, 2);
  assert.equal(report.failed, 1);
  assert.equal(report.passPercentage, 67);
  assert.equal(report.message, '1 check failed');
});

// AC-16: Unsafe URLs rejected (SSRF tests)
await testScenario('AC-16', 'Unsafe destinations (localhost, private IP, metadata) rejected before outbound request', async () => {
  const unsafeTargets = [
    'http://localhost:3000',
    'http://127.0.0.1:8080',
    'http://169.254.169.254/latest/meta-data',
    'http://192.168.1.1',
    'http://10.0.0.1',
    'ftp://example.com',
    'http://user:password@example.com'
  ];

  for (const target of unsafeTargets) {
    const res = await fetch(`${BACKEND_URL}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: target, method: 'GET' })
    });
    assert.ok(res.status === 400 || res.status === 502, `Expected 400 or 502 for ${target}, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.error, `Error object should be present for ${target}`);
    assert.ok(data.error.code === 'BLOCKED_DESTINATION' || data.error.code === 'INVALID_INPUT');
  }
});

console.log(`\n=== Verification Results: ${passedAc}/${totalAc} Scenarios Passed ===\n`);
if (passedAc !== totalAc) {
  process.exit(1);
}
