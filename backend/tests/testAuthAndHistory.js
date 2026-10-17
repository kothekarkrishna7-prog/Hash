import assert from 'node:assert/strict';
import { db } from '../src/db.js';

const BACKEND_URL = 'http://localhost:3001';

console.log('=== Running Auth, History, and Profile Backend Integration Tests ===\n');

let totalTests = 0;
let passedTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
  }
}

// Clean test users before starting
db.prepare("DELETE FROM users WHERE email LIKE '%@sentinel-test.com'").run();

const testUser = {
  name: 'Test Sentinel Engineer',
  email: `engineer_${Date.now()}@sentinel-test.com`,
  password: 'Password123!',
  confirmPassword: 'Password123!'
};

let sessionCookie = '';
let userId = '';
let historyRecordId = '';

// 1. Registration tests
await runTest('1. Rejects registration with short name', async () => {
  const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...testUser, name: 'A' })
  });
  assert.equal(res.status, 400);
});

await runTest('2. Rejects registration with mismatched password', async () => {
  const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...testUser, confirmPassword: 'DifferentPassword123!' })
  });
  assert.equal(res.status, 400);
});

await runTest('3. Successful user registration sets HttpOnly session cookie', async () => {
  const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser)
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.ok(data.user.id);
  assert.equal(data.user.email, testUser.email.toLowerCase());
  userId = data.user.id;

  const cookieHeader = res.headers.get('set-cookie');
  assert.ok(cookieHeader, 'Set-Cookie header should be present');
  assert.ok(cookieHeader.includes('sentinel_session='), 'Cookie should contain sentinel_session');
  assert.ok(cookieHeader.includes('HttpOnly'), 'Cookie should be HttpOnly');

  // Extract cookie value for subsequent requests
  sessionCookie = cookieHeader.split(';')[0];
});

await runTest('4. Rejects duplicate email registration (case-insensitive)', async () => {
  const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...testUser, email: testUser.email.toUpperCase() })
  });
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.equal(data.error.code, 'EMAIL_ALREADY_EXISTS');
});

// 2. Authentication & Session check
await runTest('5. GET /api/auth/me returns current user with valid session', async () => {
  const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: { Cookie: sessionCookie }
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.user.id, userId);
  assert.equal(data.user.name, testUser.name);
});

await runTest('6. GET /api/auth/me rejects unauthenticated request', async () => {
  const res = await fetch(`${BACKEND_URL}/api/auth/me`);
  assert.equal(res.status, 401);
});

// 3. Login tests
await runTest('7. Rejects login with wrong password', async () => {
  const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUser.email, password: 'WrongPassword999!' })
  });
  assert.equal(res.status, 401);
});

await runTest('8. Successful login returns user and sets new session cookie', async () => {
  const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUser.email, password: testUser.password })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.user.id, userId);

  const cookieHeader = res.headers.get('set-cookie');
  assert.ok(cookieHeader && cookieHeader.includes('sentinel_session='));
  sessionCookie = cookieHeader.split(';')[0];
});

// 4. Request execution with history recording
await runTest('9. Authenticated request to /api/send records history item', async () => {
  const res = await fetch(`${BACKEND_URL}/api/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie
    },
    body: JSON.stringify({
      url: 'https://jsonplaceholder.typicode.com/users/1',
      method: 'GET',
      headers: { 'X-Custom-Sentinel': 'VerifyHistory' },
      totalChecks: 3,
      passedChecks: 3,
      failedChecks: 0,
      expectedStatus: 200
    })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.historyId, 'historyId should be returned in response');
  historyRecordId = data.historyId;
});

// 5. History endpoints & IDOR protection
await runTest('10. GET /api/history returns user records with pagination', async () => {
  const res = await fetch(`${BACKEND_URL}/api/history`, {
    headers: { Cookie: sessionCookie }
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.total >= 1);
  assert.ok(data.records.length >= 1);
  const found = data.records.find((r) => r.id === historyRecordId);
  assert.ok(found, 'Created history record should appear in list');
  assert.equal(found.method, 'GET');
  assert.equal(found.status_code, 200);
});

await runTest('11. GET /api/history/:id returns full detail of record', async () => {
  const res = await fetch(`${BACKEND_URL}/api/history/${historyRecordId}`, {
    headers: { Cookie: sessionCookie }
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.record.id, historyRecordId);
  assert.ok(data.record.response_body.includes('Leanne Graham'));
});

await runTest('12. IDOR Prevention: Other user cannot access this history record', async () => {
  // Create second user
  const otherUser = {
    name: 'Second User',
    email: `other_${Date.now()}@sentinel-test.com`,
    password: 'Password123!',
    confirmPassword: 'Password123!'
  };
  const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(otherUser)
  });
  const otherCookie = regRes.headers.get('set-cookie').split(';')[0];

  // Try to access first user's record with other user's session
  const res = await fetch(`${BACKEND_URL}/api/history/${historyRecordId}`, {
    headers: { Cookie: otherCookie }
  });
  assert.equal(res.status, 404, 'Must return 404 to prevent IDOR');
});

// 6. User Profile & Password Change
await runTest('13. GET /api/user/profile returns user details and accurate stats', async () => {
  const res = await fetch(`${BACKEND_URL}/api/user/profile`, {
    headers: { Cookie: sessionCookie }
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.user.name, testUser.name);
  assert.ok(data.stats.totalRequests >= 1);
  assert.ok(data.stats.successfulResponses >= 1);
  assert.equal(data.stats.validationPassRate, 100);
});

await runTest('14. PUT /api/user/profile updates display name', async () => {
  const res = await fetch(`${BACKEND_URL}/api/user/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie
    },
    body: JSON.stringify({ name: 'Updated Sentinel Engineer' })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.user.name, 'Updated Sentinel Engineer');
});

await runTest('15. PUT /api/user/password changes password after verifying current password', async () => {
  // 1. Wrong current password fails
  const failRes = await fetch(`${BACKEND_URL}/api/user/password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie
    },
    body: JSON.stringify({
      currentPassword: 'WrongPassword!',
      newPassword: 'BrandNewPassword123!',
      confirmPassword: 'BrandNewPassword123!'
    })
  });
  assert.equal(failRes.status, 401);

  // 2. Correct current password succeeds
  const successRes = await fetch(`${BACKEND_URL}/api/user/password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie
    },
    body: JSON.stringify({
      currentPassword: testUser.password,
      newPassword: 'BrandNewPassword123!',
      confirmPassword: 'BrandNewPassword123!'
    })
  });
  assert.equal(successRes.status, 200);
});

// 7. Logout test
await runTest('16. POST /api/auth/logout invalidates session', async () => {
  const res = await fetch(`${BACKEND_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: sessionCookie }
  });
  assert.equal(res.status, 200);

  // Trying to use old session now should be rejected with 401
  const checkRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: { Cookie: sessionCookie }
  });
  assert.equal(checkRes.status, 401);
});

console.log(`\n=== Auth & History Tests Completed: ${passedTests}/${totalTests} Passed ===\n`);
if (passedTests !== totalTests) {
  process.exit(1);
}
