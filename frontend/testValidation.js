import assert from 'node:assert/strict';
import { runValidation } from './src/utils/validationEngine.js';

console.log('=== Running Frontend Validation Engine Tests (PRD Section 12) ===\n');

// Test 1: Zero assertions configured (PRD 12.9, AC-13)
console.log('--- Test 1: Zero Assertions Configured ---');
{
  const res = { status: 200, statusText: 'OK', timeMs: 120, headers: {}, body: '{"ok":true}' };
  const report = runValidation(res, {});
  assert.equal(report.total, 0);
  assert.equal(report.passed, 0);
  assert.equal(report.failed, 0);
  assert.equal(report.passPercentage, null);
  assert.equal(report.status, 'NO_CHECKS');
  assert.match(report.message, /No checks configured/i);
  console.log('  [PASS] Zero assertions correctly reports total 0, percentage null, message present.');
}

// Test 2: Expected Status Pass & Fail (PRD 12.2, AC-04, AC-05)
console.log('\n--- Test 2: Expected Status Code Check ---');
{
  const res = { status: 200, statusText: 'OK', timeMs: 90, headers: {}, body: '' };
  const passReport = runValidation(res, { expectedStatus: 200 });
  assert.equal(passReport.total, 1);
  assert.equal(passReport.passed, 1);
  assert.equal(passReport.failed, 0);
  assert.equal(passReport.passPercentage, 100);
  assert.equal(passReport.status, 'ALL_PASSED');
  assert.equal(passReport.assertions[0].passed, true);

  const failReport = runValidation(res, { expectedStatus: 201 });
  assert.equal(failReport.total, 1);
  assert.equal(failReport.passed, 0);
  assert.equal(failReport.failed, 1);
  assert.equal(failReport.passPercentage, 0);
  assert.equal(failReport.status, 'SOME_FAILED');
  assert.equal(failReport.assertions[0].passed, false);
  assert.equal(failReport.assertions[0].expected, '201');
  assert.equal(failReport.assertions[0].actual, '200');
  console.log('  [PASS] Status code equality PASS and FAIL with expected vs actual values.');
}

// Test 3: JSON Validity Check (PRD 12.3, AC-08)
console.log('\n--- Test 3: JSON Syntax Check ---');
{
  const validRes = { status: 200, statusText: 'OK', timeMs: 50, headers: {}, body: '{"name":"Alice"}' };
  const validReport = runValidation(validRes, { requireValidJson: true });
  assert.equal(validReport.assertions[0].passed, true);

  const invalidRes = { status: 200, statusText: 'OK', timeMs: 50, headers: {}, body: '<html>Error</html>' };
  const invalidReport = runValidation(invalidRes, { requireValidJson: true });
  assert.equal(invalidReport.assertions[0].passed, false);
  assert.equal(invalidReport.assertions[0].explanation, 'The response body is not valid JSON.');

  const emptyRes = { status: 200, statusText: 'OK', timeMs: 50, headers: {}, body: '' };
  const emptyReport = runValidation(emptyRes, { requireValidJson: true });
  assert.equal(emptyReport.assertions[0].passed, false);
  assert.equal(emptyReport.assertions[0].explanation, 'The response body is not valid JSON.');
  console.log('  [PASS] JSON syntax validation accurately tests valid, invalid, and empty bodies.');
}

// Test 4: Required Top-Level JSON Fields (PRD 12.4, 12.5, AC-06, AC-07)
console.log('\n--- Test 4: Required Fields ---');
{
  const res = {
    status: 200,
    statusText: 'OK',
    timeMs: 110,
    headers: {},
    body: JSON.stringify({ id: 1, title: 'Test', content: null, emptyStr: '' })
  };

  const report = runValidation(res, {
    requiredFields: ['id', 'title', 'content', 'emptyStr', 'missingField']
  });

  assert.equal(report.total, 5);
  // id -> pass
  // title -> pass
  // content (null) -> pass (PRD 12.4: property whose value is null exists)
  // emptyStr ("") -> pass (PRD 12.4: property whose value is empty string exists)
  // missingField -> fail
  assert.equal(report.passed, 4);
  assert.equal(report.failed, 1);
  assert.equal(report.passPercentage, 80);

  const missingAssertion = report.assertions.find((a) => a.field === 'missingField');
  assert.equal(missingAssertion.passed, false);
  assert.equal(missingAssertion.explanation, 'Field "missingField" is missing from the response.');
  console.log('  [PASS] Required fields (present, null, empty string, and missing) evaluated correctly.');
}

// Test 5: Required Fields on Non-Object Root (PRD 12.5)
console.log('\n--- Test 5: Required Fields on Non-Object Roots ---');
{
  const arrayRes = { status: 200, statusText: 'OK', timeMs: 40, headers: {}, body: '[1, 2, 3]' };
  const report = runValidation(arrayRes, { requiredFields: ['item'] });
  assert.equal(report.assertions[0].passed, false);
  assert.equal(
    report.assertions[0].explanation,
    'The top-level JSON value is not an object, so field names cannot be checked.'
  );

  const malformedRes = { status: 200, statusText: 'OK', timeMs: 40, headers: {}, body: 'not json' };
  const malformedReport = runValidation(malformedRes, { requiredFields: ['item'] });
  assert.equal(malformedReport.assertions[0].passed, false);
  assert.equal(
    malformedReport.assertions[0].explanation,
    'The response body is not valid JSON, so fields could not be checked.'
  );
  console.log('  [PASS] Non-object and malformed JSON roots handled per PRD 12.5 specification.');
}

// Test 6: Worked Example from PRD 12.10 (3 assertions, 2 passes -> 67%)
console.log('\n--- Test 6: Summary Calculations & Worked Example ---');
{
  const res = { status: 200, statusText: 'OK', timeMs: 150, headers: {}, body: '{"item": "val"}' };
  const report = runValidation(res, {
    expectedStatus: 200, // Pass
    requireValidJson: true, // Pass
    requiredFields: ['nonExistent'] // Fail
  });

  assert.equal(report.total, 3);
  assert.equal(report.passed, 2);
  assert.equal(report.failed, 1);
  assert.equal(report.passPercentage, 67); // Math.round(2/3 * 100) = 67
  assert.equal(report.status, 'SOME_FAILED');
  assert.equal(report.message, '1 check failed');
  console.log('  [PASS] Worked example from PRD 12.10: Total 3, Passed 2, Failed 1, 67% confirmed!');
}

console.log('\n=== All Validation Engine Tests Passed! ===\n');
