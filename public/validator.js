/**
 * API Sentinel - Validator
 * Evaluates pass/fail assertion checks against HTTP response data.
 */

(function (global) {
  'use strict';

  function getByPath(obj, path) {
    if (!obj || !path) return undefined;
    const parts = path.split('.');
    let curr = obj;
    for (const part of parts) {
      if (curr === null || curr === undefined || typeof curr !== 'object') {
        return undefined;
      }
      curr = curr[part];
    }
    return curr;
  }

  function evaluateCheck(response, check) {
    const type = (check.type || '').toLowerCase();
    const path = check.path || '';
    const expected = check.expected !== undefined ? String(check.expected).trim() : '';

    let passed = false;
    let actual = '';
    let explanation = '';

    switch (type) {
      case 'status': {
        const expStatus = parseInt(expected, 10);
        actual = String(response.status);
        passed = response.status === expStatus;
        explanation = passed
          ? `Status code ${response.status} matches expected ${expStatus}`
          : `Expected status ${expStatus}, but received ${response.status}`;
        break;
      }

      case 'time': {
        const maxMs = parseInt(expected, 10);
        actual = `${response.timeMs} ms`;
        passed = response.timeMs <= maxMs;
        explanation = passed
          ? `Latency ${response.timeMs} ms is within ${maxMs} ms limit`
          : `Latency ${response.timeMs} ms exceeded limit of ${maxMs} ms`;
        break;
      }

      case 'json-valid': {
        actual = 'Invalid JSON';
        try {
          JSON.parse(response.body);
          passed = true;
          actual = 'Valid JSON';
          explanation = 'Response body successfully parsed as JSON';
        } catch (e) {
          passed = false;
          explanation = `Failed to parse JSON: ${e.message}`;
        }
        break;
      }

      case 'field':
      case 'json-field': {
        let parsed = null;
        try {
          parsed = JSON.parse(response.body);
        } catch (e) {
          passed = false;
          actual = 'Not JSON';
          explanation = 'Response body is not valid JSON';
          break;
        }

        const val = getByPath(parsed, path);
        if (expected === '' || expected === undefined) {
          // Check for presence
          passed = val !== undefined;
          actual = passed ? (typeof val === 'object' ? JSON.stringify(val) : String(val)) : 'undefined';
          explanation = passed
            ? `Field "${path}" exists in response`
            : `Field "${path}" is missing from response`;
        } else {
          // Check equality
          actual = val !== undefined ? (typeof val === 'object' ? JSON.stringify(val) : String(val)) : 'undefined';
          passed = String(val) === expected;
          explanation = passed
            ? `Field "${path}" equals expected value "${expected}"`
            : `Field "${path}" expected "${expected}", got "${actual}"`;
        }
        break;
      }

      case 'header': {
        const headers = response.headers || {};
        const lowerKey = path.toLowerCase();
        let foundKey = Object.keys(headers).find(k => k.toLowerCase() === lowerKey);
        const val = foundKey ? headers[foundKey] : undefined;

        actual = val !== undefined ? String(val) : 'missing';
        if (expected === '') {
          passed = val !== undefined;
          explanation = passed
            ? `Header "${path}" is present`
            : `Header "${path}" is missing`;
        } else {
          passed = val !== undefined && String(val).toLowerCase().includes(expected.toLowerCase());
          explanation = passed
            ? `Header "${path}" matches "${expected}"`
            : `Header "${path}" does not match "${expected}"`;
        }
        break;
      }

      default: {
        passed = false;
        actual = 'Unknown check';
        explanation = `Check type "${type}" is not supported`;
      }
    }

    return {
      type,
      path,
      expected: expected || '(presence)',
      actual,
      passed,
      explanation
    };
  }

  function runChecks(response, checks) {
    if (!Array.isArray(checks) || checks.length === 0) {
      return {
        total: 0,
        passed: 0,
        failed: 0,
        results: []
      };
    }

    const results = checks.map(c => evaluateCheck(response, c));
    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;

    return {
      total: results.length,
      passed,
      failed,
      results
    };
  }

  global.Validator = {
    evaluateCheck,
    runChecks
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { evaluateCheck, runChecks };
  }
})(typeof window !== 'undefined' ? window : globalThis);
