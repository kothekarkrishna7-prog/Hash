import { performance } from 'node:perf_hooks';
import { validateAndResolveUrl, validateMethod, sanitizeHeaders } from './ssrfGuard.js';

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_BODY_BYTES = 1024 * 1024; // 1 MB cap (SEC-06 / FR-16)
const MAX_REDIRECTS = 3; // SEC-04

/**
 * Executes a protected outbound HTTP request.
 *
 * @param {Object} options
 * @param {string} options.url - The target URL
 * @param {string} [options.method='GET'] - HTTP method
 * @param {Record<string, string>} [options.headers={}] - Custom headers
 * @param {string} [options.body=''] - Optional body for non-GET methods
 * @param {number} [options.timeoutMs=15000] - Request timeout in milliseconds
 * @returns {Promise<{
 *   status: number,
 *   statusText: string,
 *   timeMs: number,
 *   headers: Record<string, string>,
 *   body: string,
 *   sizeBytes: number,
 *   truncated: boolean
 * }>}
 */
export async function executeRequest({
  url: rawUrl,
  method: rawMethod = 'GET',
  headers: rawHeaders = {},
  body: rawBody = '',
  timeoutMs = DEFAULT_TIMEOUT_MS
}) {
  // 1. Method validation
  let currentMethod = validateMethod(rawMethod);

  // 2. Initial URL validation & DNS pre-check
  let { url: currentUrl } = await validateAndResolveUrl(rawUrl);

  // 3. Headers sanitization
  const cleanHeaders = sanitizeHeaders(rawHeaders);

  // 4. Body handling
  let currentBody = undefined;
  if (currentMethod !== 'GET') {
    if (rawBody && typeof rawBody === 'string' && rawBody.trim().length > 0) {
      currentBody = rawBody;
      // Default Content-Type to application/json if not specified
      const hasContentType = Object.keys(cleanHeaders).some(
        (k) => k.toLowerCase() === 'content-type'
      );
      if (!hasContentType) {
        cleanHeaders['Content-Type'] = 'application/json';
      }
    }
  }

  // Set User-Agent if not custom
  const hasUserAgent = Object.keys(cleanHeaders).some(
    (k) => k.toLowerCase() === 'user-agent'
  );
  if (!hasUserAgent) {
    cleanHeaders['User-Agent'] = 'API-Sentinel/1.0 (+https://github.com/api-sentinel)';
  }

  const startTime = performance.now();
  let redirectCount = 0;
  let finalResponse = null;

  while (true) {
    // Setup abort controller for timeout (SEC-05)
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => {
      controller.abort(new Error('TIMEOUT'));
    }, timeoutMs);

    try {
      const response = await fetch(currentUrl.href, {
        method: currentMethod,
        headers: cleanHeaders,
        body: currentBody,
        redirect: 'manual', // Manual redirects for SEC-04 inspection
        signal: controller.signal
      });

      clearTimeout(timeoutHandle);

      // Check if this is a redirect status (301, 302, 303, 307, 308)
      const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
      const location = response.headers.get('location');

      if (isRedirect && location && redirectCount < MAX_REDIRECTS) {
        redirectCount++;
        // Resolve target URL relative to current URL
        let nextUrl;
        try {
          nextUrl = new URL(location, currentUrl.href);
        } catch {
          // If invalid redirect URL, stop and return the redirect response as-is
          finalResponse = response;
          break;
        }

        // SEC-04: Re-run full SSRF and IP blocking on new destination
        const resolved = await validateAndResolveUrl(nextUrl.href);
        currentUrl = resolved.url;

        // 303 See Other requires changing method to GET and removing body
        if (response.status === 303) {
          currentMethod = 'GET';
          currentBody = undefined;
        }

        // Repeat loop for next hop
        continue;
      }

      finalResponse = response;
      break;
    } catch (err) {
      clearTimeout(timeoutHandle);
      const elapsed = Math.round(performance.now() - startTime);

      if (err.name === 'AbortError' || err.message === 'TIMEOUT') {
        throw {
          code: 'TIMEOUT',
          message: `The target did not respond within ${Math.round(timeoutMs / 1000)} seconds.`,
          status: 504,
          timeMs: elapsed
        };
      }

      // Check for common connection errors
      const errMsg = err.message || '';
      if (
        errMsg.includes('ECONNREFUSED') ||
        errMsg.includes('ENOTFOUND') ||
        errMsg.includes('fetch failed') ||
        errMsg.includes('network')
      ) {
        throw {
          code: 'NETWORK_ERROR',
          message: `Network error connecting to '${currentUrl.origin}': ${err.cause?.code || err.code || 'Connection failed or refused'}.`,
          status: 502,
          timeMs: elapsed
        };
      }

      throw {
        code: 'NETWORK_ERROR',
        message: `Request execution failed: ${err.message || 'Unknown network error'}.`,
        status: 502,
        timeMs: elapsed
      };
    }
  }

  // 5. Read response body with 1 MB cap (SEC-06, FR-16)
  let bodyText = '';
  let truncated = false;
  let totalBytes = 0;

  try {
    const arrayBuffer = await finalResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    totalBytes = buffer.length;

    if (totalBytes > MAX_BODY_BYTES) {
      bodyText = buffer.subarray(0, MAX_BODY_BYTES).toString('utf-8');
      truncated = true;
    } else {
      bodyText = buffer.toString('utf-8');
    }
  } catch (err) {
    bodyText = '';
  }

  const elapsedMs = Math.round(performance.now() - startTime);

  // 6. Convert response headers to plain object
  const responseHeaders = {};
  finalResponse.headers.forEach((val, key) => {
    // Mask sensitive response headers if needed (SEC-15)
    responseHeaders[key.toLowerCase()] = val;
  });

  return {
    status: finalResponse.status,
    statusText: finalResponse.statusText || '',
    timeMs: elapsedMs,
    headers: responseHeaders,
    body: bodyText,
    sizeBytes: totalBytes,
    truncated
  };
}
