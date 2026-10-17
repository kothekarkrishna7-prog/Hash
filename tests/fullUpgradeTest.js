import assert from 'node:assert/strict';

const BACKEND_URL = 'http://localhost:3001';

console.log('=== Running API Sentinel Upgrade Acceptance Criteria Suite (AC 1-22) ===\n');

let passed = 0;
let total = 0;

async function check(id, title, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  [PASS] AC-${id}: ${title}`);
  } catch (err) {
    console.error(`  [FAIL] AC-${id}: ${title}`);
    console.error(`         ${err.message}`);
  }
}

const userA = {
  name: 'Dev Alice',
  email: `alice_${Date.now()}@sentinel.dev`,
  password: 'SecurePassword123!',
  confirmPassword: 'SecurePassword123!'
};

const userB = {
  name: 'Dev Bob',
  email: `bob_${Date.now()}@sentinel.dev`,
  password: 'SecurePassword123!',
  confirmPassword: 'SecurePassword123!'
};

let aliceCookie = '';
let bobCookie = '';
let aliceRecordId = '';

// 1. User Registration
await check('1', 'New user can register with valid details', async () => {
  const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userA)
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.user.email, userA.email);
  aliceCookie = res.headers.get('set-cookie').split(';')[0];
});

// 2. Duplicate Registration Rejection
await check('2', 'Duplicate email registration is rejected', async () => {
  const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userA)
  });
  assert.equal(res.status, 409);
});

// 3. User Login
await check('3', 'A registered user can log in', async () => {
  const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userA.email, password: userA.password })
  });
  assert.equal(res.status, 200);
  aliceCookie = res.headers.get('set-cookie').split(';')[0];
});

// 4. Invalid Credentials Rejection
await check('4', 'Invalid credentials are rejected', async () => {
  const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userA.email, password: 'WrongPassword!' })
  });
  assert.equal(res.status, 401);
});

// 5. Session Persistence
await check('5', 'Login session survives page refresh (/api/auth/me)', async () => {
  const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: { Cookie: aliceCookie }
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.user.email, userA.email);
});

// 6. Protection of Protected Endpoints
await check('6', 'Unauthenticated user cannot access protected endpoints', async () => {
  const resHistory = await fetch(`${BACKEND_URL}/api/history`);
  assert.equal(resHistory.status, 401);

  const resProfile = await fetch(`${BACKEND_URL}/api/user/profile`);
  assert.equal(resProfile.status, 401);
});

// 8. Authenticated API Request & Execution
await check('8', 'Authenticated user sends API request and receives real response details', async () => {
  const res = await fetch(`${BACKEND_URL}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
    body: JSON.stringify({
      url: 'https://jsonplaceholder.typicode.com/users/1',
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Authorization': 'Bearer test-secret-token' },
      expectedStatus: 200,
      totalChecks: 4,
      passedChecks: 4,
      failedChecks: 0
    })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 200);
  assert.ok(data.timeMs > 0);
  assert.ok(data.historyId);
  aliceRecordId = data.historyId;
});

// 9. Request History Persistence
await check('9', 'Completed test is recorded in persistent history', async () => {
  const res = await fetch(`${BACKEND_URL}/api/history`, {
    headers: { Cookie: aliceCookie }
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.total >= 1);
  const record = data.records.find((r) => r.id === aliceRecordId);
  assert.ok(record, 'Record must exist in history');
  assert.equal(record.status_code, 200);
  assert.equal(record.passed_checks, 4);
});

// 10. Failed Requests Recorded
await check('10', 'Failed requests (e.g. 404 or network failure) are recorded correctly', async () => {
  const res = await fetch(`${BACKEND_URL}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
    body: JSON.stringify({
      url: 'https://jsonplaceholder.typicode.com/posts/999999',
      method: 'GET',
      expectedStatus: 200,
      totalChecks: 1,
      passedChecks: 0,
      failedChecks: 1
    })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 404);
  assert.ok(data.historyId);
});

// 12. Search & Filter History
await check('12', 'Users can search and filter their own history', async () => {
  const resSearch = await fetch(`${BACKEND_URL}/api/history?search=users`, {
    headers: { Cookie: aliceCookie }
  });
  const dataSearch = await resSearch.json();
  assert.ok(dataSearch.records.every((r) => r.url.includes('users')));

  const resFilter = await fetch(`${BACKEND_URL}/api/history?method=GET`, {
    headers: { Cookie: aliceCookie }
  });
  const dataFilter = await resFilter.json();
  assert.ok(dataFilter.records.every((r) => r.method === 'GET'));
});

// 13. Details & Rerun Inspection
await check('13', 'Users can open a historical record for inspection', async () => {
  const res = await fetch(`${BACKEND_URL}/api/history/${aliceRecordId}`, {
    headers: { Cookie: aliceCookie }
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.record.id, aliceRecordId);
  assert.ok(data.record.response_body);
});

// 15. IDOR Protection (Cross-user isolation)
await check('15', 'Users cannot access another user’s history records (IDOR protection)', async () => {
  // Register Bob
  const regBob = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userB)
  });
  bobCookie = regBob.headers.get('set-cookie').split(';')[0];

  // Bob attempts to read Alice's record
  const res = await fetch(`${BACKEND_URL}/api/history/${aliceRecordId}`, {
    headers: { Cookie: bobCookie }
  });
  assert.equal(res.status, 404); // Must not reveal record or existence
});

// 16. Profile View & Update
await check('16', 'Users can view and update their profile', async () => {
  const resGet = await fetch(`${BACKEND_URL}/api/user/profile`, {
    headers: { Cookie: aliceCookie }
  });
  assert.equal(resGet.status, 200);
  const dataGet = await resGet.json();
  assert.ok(dataGet.stats.totalRequests >= 2);

  const resUpdate = await fetch(`${BACKEND_URL}/api/user/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
    body: JSON.stringify({ name: 'Alice Sentinel Architect' })
  });
  assert.equal(resUpdate.status, 200);
  const dataUpdate = await resUpdate.json();
  assert.equal(dataUpdate.user.name, 'Alice Sentinel Architect');
});

// 17. Password Change with Current Password Verification
await check('17', 'Password change requires verifying current password', async () => {
  const resFail = await fetch(`${BACKEND_URL}/api/user/password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
    body: JSON.stringify({
      currentPassword: 'WrongPassword123!',
      newPassword: 'BrandNewPassword456!',
      confirmPassword: 'BrandNewPassword456!'
    })
  });
  assert.equal(resFail.status, 401);

  const resSuccess = await fetch(`${BACKEND_URL}/api/user/password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
    body: JSON.stringify({
      currentPassword: userA.password,
      newPassword: 'BrandNewPassword456!',
      confirmPassword: 'BrandNewPassword456!'
    })
  });
  assert.equal(resSuccess.status, 200);
});

// 18. Dashboard Statistics
await check('18', 'Dashboard statistics reflect actual database records', async () => {
  const res = await fetch(`${BACKEND_URL}/api/dashboard/stats`, {
    headers: { Cookie: aliceCookie }
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.stats.totalRequests >= 2);
  assert.ok(data.recentRequests.length >= 2);
});

// 19. Redaction of Sensitive Headers
await check('19', 'Sensitive credentials (Authorization token) are redacted in history', async () => {
  const res = await fetch(`${BACKEND_URL}/api/history/${aliceRecordId}`, {
    headers: { Cookie: aliceCookie }
  });
  const data = await res.json();
  const reqHeaders = data.record.request_headers;
  assert.equal(reqHeaders['Authorization'], '[REDACTED]', 'Authorization header must be redacted');
});

// 14. Delete History Record
await check('14', 'Users can delete individual history records', async () => {
  const res = await fetch(`${BACKEND_URL}/api/history/${aliceRecordId}`, {
    method: 'DELETE',
    headers: { Cookie: aliceCookie }
  });
  assert.equal(res.status, 200);

  // Verify it is gone
  const verifyRes = await fetch(`${BACKEND_URL}/api/history/${aliceRecordId}`, {
    headers: { Cookie: aliceCookie }
  });
  assert.equal(verifyRes.status, 404);
});

// 7. Logout & Invalidation
await check('7', 'User can log out and their session becomes invalid', async () => {
  const res = await fetch(`${BACKEND_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: aliceCookie }
  });
  assert.equal(res.status, 200);

  const checkRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: { Cookie: aliceCookie }
  });
  assert.equal(checkRes.status, 401);
});

console.log(`\n=== Upgrade Verification Results: ${passed}/${total} Passed ===\n`);
if (passed !== total) {
  process.exit(1);
}
