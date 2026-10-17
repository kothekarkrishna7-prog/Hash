import assert from 'node:assert/strict';

const PROXY_URL = 'http://127.0.0.1:5173';
const DIRECT_URL = 'http://localhost:3001';

console.log('=== Running End-to-End Section 7 Verification Suite ===\n');

let passed = 0;
let total = 0;

async function test(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  [PASS] Test ${total}: ${name}`);
  } catch (err) {
    console.error(`  [FAIL] Test ${total}: ${name}`);
    console.error(`         ${err.message}`);
    process.exitCode = 1;
  }
}

const timestamp = Date.now();
const user1 = {
  name: 'Tester One',
  email: `tester1_${timestamp}@sentinel.dev`,
  password: 'Password123!',
  confirmPassword: 'Password123!'
};

const user2 = {
  name: 'Tester Two',
  email: `tester2_${timestamp}@sentinel.dev`,
  password: 'Password123!',
  confirmPassword: 'Password123!'
};

let user1Token = '';
let user2Token = '';
let test1RecordId = '';
let test404RecordId = '';
let networkErrorRecordId = '';

// Test 1: Register and login user 1 through Vite proxy, receive token and test HTTP 200
await test('Register/Login through proxy and execute HTTP 200 test', async () => {
  const regRes = await fetch(`${PROXY_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user1)
  });
  assert.equal(regRes.status, 201, 'Registration should succeed with 201');
  const regData = await regRes.json();
  assert.ok(regData.token, 'Registration must return session token');
  user1Token = regData.token;

  // Execute HTTP 200 test using Bearer token through proxy
  const sendRes = await fetch(`${PROXY_URL}/api/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user1Token}`
    },
    body: JSON.stringify({
      url: 'https://jsonplaceholder.typicode.com/users/1',
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      expectedStatus: 200,
      requireValidJson: true,
      requiredFields: ['id', 'name', 'username', 'email'],
      maxTimeMs: 3000
    })
  });
  assert.equal(sendRes.status, 200);
  const sendData = await sendRes.json();
  assert.equal(sendData.status, 200);
  assert.ok(sendData.historyId, 'HTTP 200 test must create a historyId');
  test1RecordId = sendData.historyId;
  assert.equal(sendData.historySaved, true);
  // 1 (expectedStatus) + 1 (requireValidJson) + 4 (requiredFields) + 1 (maxTimeMs) = 7 checks
  assert.equal(sendData.validationSummary.totalChecks, 7);
  assert.equal(sendData.validationSummary.passedChecks, 7);
  assert.equal(sendData.validationSummary.failedChecks, 0);
});

// Test 2: Test an API that returns HTTP 404
await test('Execute HTTP 404 test and verify it is recorded', async () => {
  const res = await fetch(`${PROXY_URL}/api/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user1Token}`
    },
    body: JSON.stringify({
      url: 'https://jsonplaceholder.typicode.com/posts/999999',
      method: 'GET',
      expectedStatus: 200 // Expect 200 so validation fails
    })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 404);
  assert.ok(data.historyId, '404 request must have historyId');
  assert.equal(data.historySaved, true);
  assert.equal(data.validationSummary.failedChecks, 1, 'Expected status check should fail');
  test404RecordId = data.historyId;
});

// Test 3: Test an invalid or unreachable URL
await test('Execute invalid/unreachable URL test and verify failure is recorded', async () => {
  const res = await fetch(`${PROXY_URL}/api/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user1Token}`
    },
    body: JSON.stringify({
      url: 'http://this-domain-definitely-does-not-exist-12345.xyz/api',
      method: 'GET',
      expectedStatus: 200
    })
  });
  assert.ok(res.status >= 400);
  const data = await res.json();
  assert.ok(data.error, 'Network failure must return error object');
  assert.ok(data.historyId, 'Network error must still be saved to history');
  assert.equal(data.historySaved, true);
  networkErrorRecordId = data.historyId;
});

// Test 4: Run validation that passes and another that fails
await test('Validation pass and fail distinction', async () => {
  // Check record 1 (All passed)
  const detail1 = await fetch(`${PROXY_URL}/api/history/${test1RecordId}`, {
    headers: { 'Authorization': `Bearer ${user1Token}` }
  });
  const data1 = await detail1.json();
  assert.equal(data1.record.total_checks, 7);
  assert.equal(data1.record.failed_checks, 0);

  // Check record 2 (404, expected 200 -> Failed check)
  const detail2 = await fetch(`${PROXY_URL}/api/history/${test404RecordId}`, {
    headers: { 'Authorization': `Bearer ${user1Token}` }
  });
  const data2 = await detail2.json();
  assert.equal(data2.record.total_checks, 1);
  assert.equal(data2.record.failed_checks, 1);
});

// Test 5: Open History and verify all completed tests appear (newest first)
await test('Open History and verify all 3 completed tests appear newest first', async () => {
  const res = await fetch(`${PROXY_URL}/api/history`, {
    headers: { 'Authorization': `Bearer ${user1Token}` }
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.total, 3, 'User 1 should have exactly 3 saved history records');
  assert.equal(data.records.length, 3);
  // Check newest first ordering
  const timestamps = data.records.map((r) => new Date(r.timestamp).getTime());
  assert.ok(timestamps[0] >= timestamps[1] && timestamps[1] >= timestamps[2], 'History must be newest first');
});

// Test 6: Open Dashboard and verify counts and recent activity match saved records
await test('Open Dashboard and verify counts and recent activity match saved records', async () => {
  const res = await fetch(`${PROXY_URL}/api/dashboard/stats`, {
    headers: { 'Authorization': `Bearer ${user1Token}` }
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  const { stats, recentRequests } = data;

  assert.equal(stats.totalRequests, 3, 'Total API Tests must be 3');
  assert.equal(stats.successfulResponses, 1, 'Successful Requests (200-299) must be 1');
  assert.equal(stats.failedExecutions, 2, 'Failed Requests (non-2xx + network error) must be 2');
  assert.equal(stats.totalRequests, stats.successfulResponses + stats.failedExecutions, 'No record counted twice');
  // Pass rate: out of 3 tests, test1 (4 checks, 0 failed -> passed validation), test2 (1 check, 1 failed -> failed validation), test3 (1 check, 1 failed -> failed validation)
  // 1 out of 3 tests passed validations = 33%
  assert.equal(stats.validationPassRate, 33);
  assert.equal(recentRequests.length, 3, 'Recent activity must have 3 items');
});

// Test 7: Verify session survives and data persists
await test('Session survives page refresh check (/api/auth/me)', async () => {
  const res = await fetch(`${PROXY_URL}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${user1Token}` }
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.user.email, user1.email);
});

// Test 8: Log out and back in and confirm user history remains
await test('Log out and back in, confirm user history remains', async () => {
  // Logout
  const logoutRes = await fetch(`${PROXY_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${user1Token}` }
  });
  assert.equal(logoutRes.status, 200);

  // Old token now rejected
  const rejected = await fetch(`${PROXY_URL}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${user1Token}` }
  });
  assert.equal(rejected.status, 401);

  // Login again
  const loginRes = await fetch(`${PROXY_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user1.email, password: user1.password })
  });
  assert.equal(loginRes.status, 200);
  const loginData = await loginRes.json();
  assert.ok(loginData.token);
  user1Token = loginData.token;

  // Verify history remains
  const histRes = await fetch(`${PROXY_URL}/api/history`, {
    headers: { 'Authorization': `Bearer ${user1Token}` }
  });
  const histData = await histRes.json();
  assert.equal(histData.total, 3, 'User history must persist across login sessions');
});

// Test 9: Register second user and verify cross-user isolation (IDOR protection)
await test('Second user cannot access first user history or stats (IDOR check)', async () => {
  const reg2 = await fetch(`${PROXY_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user2)
  });
  assert.equal(reg2.status, 201);
  const data2 = await reg2.json();
  user2Token = data2.token;

  // User 2 history must be completely empty
  const user2Hist = await fetch(`${PROXY_URL}/api/history`, {
    headers: { 'Authorization': `Bearer ${user2Token}` }
  });
  const u2Data = await user2Hist.json();
  assert.equal(u2Data.total, 0, 'New user history must be 0');
  assert.equal(u2Data.records.length, 0);

  // User 2 dashboard stats must be 0 and validationPassRate must be null
  const user2Stats = await fetch(`${PROXY_URL}/api/dashboard/stats`, {
    headers: { 'Authorization': `Bearer ${user2Token}` }
  });
  const u2StatsData = await user2Stats.json();
  assert.equal(u2StatsData.stats.totalRequests, 0);
  assert.equal(u2StatsData.stats.validationPassRate, null, 'No validations -> validationPassRate is null');
  assert.equal(u2StatsData.recentRequests.length, 0);

  // User 2 attempts to view User 1 detail -> 404
  const idorRes = await fetch(`${PROXY_URL}/api/history/${test1RecordId}`, {
    headers: { 'Authorization': `Bearer ${user2Token}` }
  });
  assert.equal(idorRes.status, 404, 'Must return 404 for records belonging to other users');
});

// Test 10: Server error handling (useful error message, not falsely empty)
await test('Server returns appropriate HTTP status and error message on error', async () => {
  // Test accessing without auth
  const unauthRes = await fetch(`${PROXY_URL}/api/history`);
  assert.equal(unauthRes.status, 401);
  const unauthData = await unauthRes.json();
  assert.ok(unauthData.error?.message, 'Must return descriptive error message');
});

console.log(`\n=== Verification Complete: ${passed}/${total} Passed ===`);
