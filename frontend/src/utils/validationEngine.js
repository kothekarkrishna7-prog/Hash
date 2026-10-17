/**
 * API Sentinel - Validation Engine (PRD Section 12)
 * Pure, deterministic functions to evaluate API responses against configured assertions.
 */

/**
 * Evaluates configured assertions against the API response.
 *
 * @param {Object} response - The API response object from backend
 * @param {number} response.status - HTTP status code
 * @param {string} response.statusText - HTTP status text
 * @param {number} response.timeMs - Response roundtrip time in milliseconds
 * @param {Record<string, string>} response.headers - Response headers
 * @param {string} response.body - Raw response body string
 * @param {Object} config - Configured assertions
 * @param {number|string|null} [config.expectedStatus] - Expected HTTP status code (100 - 599)
 * @param {boolean} [config.requireValidJson=false] - Whether body must parse as JSON
 * @param {string[]} [config.requiredFields=[]] - List of required top-level JSON fields
 * @param {number|string|null} [config.maxTimeMs] - Optional response time threshold in ms
 * @returns {ValidationReport}
 */
export function runValidation(response, config = {}) {
  const assertions = [];

  if (!response || typeof response.status !== 'number') {
    return {
      total: 0,
      passed: 0,
      failed: 0,
      passPercentage: null,
      status: 'NO_RESPONSE',
      message: 'No response available for validation.',
      assertions: []
    };
  }

  const {
    expectedStatus,
    requireValidJson = false,
    requiredFields = [],
    maxTimeMs
  } = config;

  // 1. Status Code Equality (PRD 12.2)
  if (
    expectedStatus !== undefined &&
    expectedStatus !== null &&
    String(expectedStatus).trim() !== ''
  ) {
    const expCode = parseInt(String(expectedStatus).trim(), 10);
    if (!isNaN(expCode) && expCode >= 100 && expCode <= 599) {
      const isPass = response.status === expCode;
      assertions.push({
        id: 'status_code',
        name: 'HTTP Status Code',
        type: 'STATUS',
        passed: isPass,
        expected: `${expCode}`,
        actual: `${response.status}`,
        explanation: isPass
          ? `Status code ${response.status} matches expected ${expCode}.`
          : `Expected HTTP status ${expCode}, but received ${response.status}.`
      });
    }
  }

  // Pre-parse JSON body to share across JSON syntax and field assertions (PRD 12.3, 12.5)
  let parsedJson = null;
  let isJsonValid = false;
  const rawBody = typeof response.body === 'string' ? response.body : '';
  const trimmedBody = rawBody.trim();

  if (trimmedBody.length > 0) {
    try {
      parsedJson = JSON.parse(trimmedBody);
      isJsonValid = true;
    } catch {
      isJsonValid = false;
    }
  } else {
    // Empty body is NOT valid JSON (PRD 12.3)
    isJsonValid = false;
  }

  // 2. JSON Validity Check (PRD 12.3)
  if (requireValidJson) {
    assertions.push({
      id: 'json_syntax',
      name: 'JSON Syntax Validity',
      type: 'JSON_SYNTAX',
      passed: isJsonValid,
      expected: 'Valid JSON',
      actual: isJsonValid ? 'Valid JSON' : trimmedBody.length === 0 ? 'Empty body' : 'Malformed / Non-JSON',
      explanation: isJsonValid
        ? 'Response body is syntactically valid JSON.'
        : 'The response body is not valid JSON.'
    });
  }

  // 3. Required Top-Level JSON Fields (PRD 12.4, 12.5)
  // Clean, trim, and de-duplicate required fields
  const fieldsToCheck = Array.from(
    new Set(
      (Array.isArray(requiredFields) ? requiredFields : [])
        .map((f) => (typeof f === 'string' ? f.trim() : ''))
        .filter((f) => f.length > 0)
    )
  );

  for (const field of fieldsToCheck) {
    const assertionId = `field_${field}`;

    if (!isJsonValid) {
      // Body is malformed, empty, or plain text
      assertions.push({
        id: assertionId,
        name: `Required Field: "${field}"`,
        type: 'REQUIRED_FIELD',
        field,
        passed: false,
        expected: 'Field present',
        actual: 'Invalid JSON',
        explanation: 'The response body is not valid JSON, so fields could not be checked.'
      });
      continue;
    }

    // Top-level value must be an object (not array, primitive, or null)
    const isObject =
      parsedJson !== null &&
      typeof parsedJson === 'object' &&
      !Array.isArray(parsedJson);

    if (!isObject) {
      assertions.push({
        id: assertionId,
        name: `Required Field: "${field}"`,
        type: 'REQUIRED_FIELD',
        field,
        passed: false,
        expected: 'Field present',
        actual: 'Non-object root',
        explanation: 'The top-level JSON value is not an object, so field names cannot be checked.'
      });
      continue;
    }

    // Check if property exists on top-level object
    const fieldExists = Object.prototype.hasOwnProperty.call(parsedJson, field);

    assertions.push({
      id: assertionId,
      name: `Required Field: "${field}"`,
      type: 'REQUIRED_FIELD',
      field,
      passed: fieldExists,
      expected: 'Field present',
      actual: fieldExists ? 'Present' : 'Missing',
      explanation: fieldExists
        ? `Field "${field}" exists in response body.`
        : `Field "${field}" is missing from the response.`
    });
  }

  // 4. Response Time Threshold Check (P1 / PRD 12.1, FR-30)
  if (
    maxTimeMs !== undefined &&
    maxTimeMs !== null &&
    String(maxTimeMs).trim() !== ''
  ) {
    const threshold = parseInt(String(maxTimeMs).trim(), 10);
    if (!isNaN(threshold) && threshold > 0) {
      const actualTime = response.timeMs ?? 0;
      const isPass = actualTime <= threshold;
      assertions.push({
        id: 'response_time',
        name: 'Response Time Threshold',
        type: 'RESPONSE_TIME',
        passed: isPass,
        expected: `≤ ${threshold} ms`,
        actual: `${actualTime} ms`,
        explanation: isPass
          ? `Response received in ${actualTime} ms (threshold: ${threshold} ms).`
          : `Response time of ${actualTime} ms exceeded target threshold of ${threshold} ms.`
      });
    }
  }

  // 5. Summary Calculations (PRD 12.9, 12.10)
  const total = assertions.length;
  const passed = assertions.filter((a) => a.passed).length;
  const failed = total - passed;
  const passPercentage = total > 0 ? Math.round((passed / total) * 100) : null;

  let overallStatus = 'NO_CHECKS';
  let bannerMessage = 'No checks configured. Add a check to validate this response.';

  if (total > 0) {
    if (failed === 0) {
      overallStatus = 'ALL_PASSED';
      bannerMessage = 'All checks passed';
    } else {
      overallStatus = 'SOME_FAILED';
      bannerMessage = `${failed} check${failed > 1 ? 's' : ''} failed`;
    }
  }

  return {
    total,
    passed,
    failed,
    passPercentage,
    status: overallStatus,
    message: bannerMessage,
    assertions,
    isJsonValid,
    parsedJson
  };
}
