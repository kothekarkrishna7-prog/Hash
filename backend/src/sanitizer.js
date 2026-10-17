/**
 * Utilities to sanitize and redact sensitive headers and body fields
 * before persisting to the history database or logging.
 */

const SENSITIVE_HEADER_PATTERNS = [
  /^authorization$/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /^x-api-key$/i,
  /^api-key$/i,
  /^x-auth-token$/i,
  /^x-access-token$/i,
  /^token$/i,
  /^proxy-authorization$/i,
  /^bearer$/i,
  /^apikey$/i,
  /^secret$/i,
  /^x-csrf-token$/i
];

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /pass/i,
  /secret/i,
  /token/i,
  /apikey/i,
  /api_key/i,
  /access_token/i,
  /refresh_token/i,
  /private_key/i,
  /client_secret/i,
  /credit_?card/i,
  /cvv/i
];

/**
 * Redacts sensitive headers from an object of headers.
 * @param {Record<string, string>} headers
 * @returns {Record<string, string>}
 */
export function sanitizeHeaders(headers) {
  if (!headers || typeof headers !== 'object') return {};
  const clean = {};

  for (const [key, value] of Object.entries(headers)) {
    const isSensitive = SENSITIVE_HEADER_PATTERNS.some((pattern) => pattern.test(key));
    if (isSensitive) {
      clean[key] = '[REDACTED]';
    } else {
      clean[key] = value;
    }
  }

  return clean;
}

/**
 * Sanitizes JSON or text body, masking password or secret fields.
 * @param {string} bodyStr
 * @returns {string}
 */
export function sanitizeBody(bodyStr) {
  if (!bodyStr || typeof bodyStr !== 'string') return '';
  const trimmed = bodyStr.trim();
  if (!trimmed) return '';

  try {
    const parsed = JSON.parse(trimmed);
    const sanitizedObj = maskSensitiveValues(parsed);
    return JSON.stringify(sanitizedObj, null, 2);
  } catch {
    // If not JSON, check for password parameters in URL-encoded or plain string
    return trimmed.replace(
      /((?:password|secret|token|api_?key)\s*[=:]\s*["']?)([^&"'\s\n]+)/gi,
      '$1[REDACTED]'
    );
  }
}

/**
 * Recursively masks sensitive fields in an object or array.
 */
function maskSensitiveValues(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => maskSensitiveValues(item));
  }

  const masked = {};
  for (const [key, value] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
    if (isSensitive) {
      masked[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveValues(value);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}
