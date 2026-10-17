import assert from 'node:assert/strict';
import { isIpBlocked, validateAndResolveUrl, validateMethod, sanitizeHeaders } from '../src/ssrfGuard.js';
import { executeRequest } from '../src/requestExecutor.js';

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
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

console.log('=== Running Backend SSRF & Request Executor Tests ===\n');

// 1. IP Blocking tests (SEC-02)
console.log('--- 1. Testing IP Block Rules (SEC-02) ---');
runTest('Blocks IPv4 loopback 127.0.0.1', () => {
  assert.equal(isIpBlocked('127.0.0.1'), true);
});

runTest('Blocks IPv4 loopback 127.255.255.255', () => {
  assert.equal(isIpBlocked('127.255.255.255'), true);
});

runTest('Blocks AWS Cloud Metadata 169.254.169.254', () => {
  assert.equal(isIpBlocked('169.254.169.254'), true);
});

runTest('Blocks RFC 1918 Private 10.0.0.1', () => {
  assert.equal(isIpBlocked('10.0.0.1'), true);
});

runTest('Blocks RFC 1918 Private 172.16.5.1', () => {
  assert.equal(isIpBlocked('172.16.5.1'), true);
});

runTest('Blocks RFC 1918 Private 192.168.1.1', () => {
  assert.equal(isIpBlocked('192.168.1.1'), true);
});

runTest('Blocks Carrier-grade NAT 100.64.0.1', () => {
  assert.equal(isIpBlocked('100.64.0.1'), true);
});

runTest('Blocks IPv6 loopback ::1', () => {
  assert.equal(isIpBlocked('::1'), true);
});

runTest('Blocks IPv6 unique-local fc00::1', () => {
  assert.equal(isIpBlocked('fc00::1'), true);
});

runTest('Blocks IPv6 link-local fe80::1', () => {
  assert.equal(isIpBlocked('fe80::1'), true);
});

runTest('Blocks IPv4-mapped IPv6 loopback ::ffff:127.0.0.1', () => {
  assert.equal(isIpBlocked('::ffff:127.0.0.1'), true);
});

runTest('Blocks IPv4-mapped IPv6 metadata ::ffff:169.254.169.254', () => {
  assert.equal(isIpBlocked('::ffff:169.254.169.254'), true);
});

runTest('Allows public IP 8.8.8.8', () => {
  assert.equal(isIpBlocked('8.8.8.8'), false);
});

runTest('Allows public IP 1.1.1.1', () => {
  assert.equal(isIpBlocked('1.1.1.1'), false);
});

// 2. URL & Protocol Validation (SEC-01)
console.log('\n--- 2. Testing URL & Protocol Validation (SEC-01) ---');
await runAsyncTest('Rejects non-HTTP scheme ftp://example.com', async () => {
  await assert.rejects(
    async () => await validateAndResolveUrl('ftp://example.com/file'),
    (err) => err.code === 'INVALID_INPUT'
  );
});

await runAsyncTest('Rejects file:// scheme', async () => {
  await assert.rejects(
    async () => await validateAndResolveUrl('file:///etc/passwd'),
    (err) => err.code === 'INVALID_INPUT'
  );
});

await runAsyncTest('Rejects embedded credentials http://user:pass@example.com', async () => {
  await assert.rejects(
    async () => await validateAndResolveUrl('http://user:pass@example.com'),
    (err) => err.code === 'INVALID_INPUT'
  );
});

await runAsyncTest('Rejects localhost hostname', async () => {
  await assert.rejects(
    async () => await validateAndResolveUrl('http://localhost:8080'),
    (err) => err.code === 'BLOCKED_DESTINATION'
  );
});

await runAsyncTest('Rejects private IP literal http://192.168.1.100', async () => {
  await assert.rejects(
    async () => await validateAndResolveUrl('http://192.168.1.100'),
    (err) => err.code === 'BLOCKED_DESTINATION'
  );
});

await runAsyncTest('Rejects metadata IP literal http://169.254.169.254', async () => {
  await assert.rejects(
    async () => await validateAndResolveUrl('http://169.254.169.254/latest'),
    (err) => err.code === 'BLOCKED_DESTINATION'
  );
});

// 3. Method and Header Validation (SEC-07, SEC-08)
console.log('\n--- 3. Testing Method & Header Validation (SEC-07, SEC-08) ---');
runTest('Validates GET, POST, PUT, PATCH, DELETE', () => {
  assert.equal(validateMethod('get'), 'GET');
  assert.equal(validateMethod('POST'), 'POST');
  assert.equal(validateMethod('put'), 'PUT');
  assert.equal(validateMethod('patch'), 'PATCH');
  assert.equal(validateMethod('delete'), 'DELETE');
});

runTest('Rejects disallowed method HEAD, TRACE, CONNECT', () => {
  assert.throws(() => validateMethod('HEAD'), (err) => err.code === 'INVALID_INPUT');
  assert.throws(() => validateMethod('TRACE'), (err) => err.code === 'INVALID_INPUT');
  assert.throws(() => validateMethod('CONNECT'), (err) => err.code === 'INVALID_INPUT');
});

runTest('Strips unsafe proxy control headers', () => {
  const headers = {
    'Host': 'evil.com',
    'Connection': 'close',
    'Content-Length': '123',
    'Transfer-Encoding': 'chunked',
    'X-Custom-Auth': 'Bearer token123',
    'Accept': 'application/json'
  };
  const clean = sanitizeHeaders(headers);
  assert.equal(clean['Host'], undefined);
  assert.equal(clean['Connection'], undefined);
  assert.equal(clean['Content-Length'], undefined);
  assert.equal(clean['Transfer-Encoding'], undefined);
  assert.equal(clean['X-Custom-Auth'], 'Bearer token123');
  assert.equal(clean['Accept'], 'application/json');
});

runTest('Rejects header names with invalid characters', () => {
  assert.throws(
    () => sanitizeHeaders({ 'Bad Header Name': 'value' }),
    (err) => err.code === 'INVALID_INPUT'
  );
});

runTest('Rejects header values with CRLF injection', () => {
  assert.throws(
    () => sanitizeHeaders({ 'X-Injected': 'val\r\nSet-Cookie: evil=1' }),
    (err) => err.code === 'INVALID_INPUT'
  );
});

// 4. Live Outbound Request Tests (FR-09 - FR-15, AC-01, AC-10, AC-11)
console.log('\n--- 4. Testing Live Execution via RequestExecutor ---');
await runAsyncTest('AC-01: Successful GET request to JSONPlaceholder', async () => {
  const result = await executeRequest({
    url: 'https://jsonplaceholder.typicode.com/posts/1',
    method: 'GET'
  });
  assert.equal(result.status, 200);
  assert.ok(result.timeMs > 0, 'timeMs should be positive');
  assert.ok(result.body.includes('userId'), 'Body should contain userId');
  assert.equal(result.truncated, false);
});

await runAsyncTest('AC-10: Target 404 is treated as successful execution with status 404', async () => {
  const result = await executeRequest({
    url: 'https://jsonplaceholder.typicode.com/posts/99999999',
    method: 'GET'
  });
  assert.equal(result.status, 404);
  assert.ok(result.timeMs > 0);
});

await runAsyncTest('AC-11: Network failure for non-existent domain returns NETWORK_ERROR', async () => {
  await assert.rejects(
    async () =>
      await executeRequest({
        url: 'https://domain-definitely-does-not-exist-sentinel-xyz123.com',
        method: 'GET'
      }),
    (err) => err.code === 'NETWORK_ERROR'
  );
});

await runAsyncTest('AC-16: SSRF blocked destination returns BLOCKED_DESTINATION error', async () => {
  await assert.rejects(
    async () =>
      await executeRequest({
        url: 'http://169.254.169.254/latest/meta-data',
        method: 'GET'
      }),
    (err) => err.code === 'BLOCKED_DESTINATION'
  );
});

console.log(`\n=== Backend Tests Completed: ${passedTests}/${totalTests} Passed ===\n`);
if (passedTests !== totalTests) {
  process.exit(1);
}
