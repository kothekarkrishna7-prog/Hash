import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

// Allowed HTTP methods according to SEC-07
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

// Disallowed proxy/hop-by-hop headers according to SEC-08
const STRIPPED_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'keep-alive',
  'proxy-authorization',
  'proxy-authenticate',
  'te',
  'trailer',
  'upgrade',
  'expect'
]);

// Blocked IPv4 CIDR ranges per SEC-02
const BLOCKED_IPV4_CIDRS = [
  ipaddr.parseCIDR('0.0.0.0/8'),       // Unspecified / current network
  ipaddr.parseCIDR('10.0.0.0/8'),      // RFC 1918 Private
  ipaddr.parseCIDR('100.64.0.0/10'),   // RFC 6598 Carrier-Grade NAT
  ipaddr.parseCIDR('127.0.0.0/8'),     // Loopback
  ipaddr.parseCIDR('169.254.0.0/16'),  // RFC 3927 Link-Local (Cloud metadata 169.254.169.254)
  ipaddr.parseCIDR('172.16.0.0/12'),   // RFC 1918 Private
  ipaddr.parseCIDR('192.0.0.0/24'),    // IETF Protocol Assignments
  ipaddr.parseCIDR('192.0.2.0/24'),    // TEST-NET-1
  ipaddr.parseCIDR('192.168.0.0/16'),  // RFC 1918 Private
  ipaddr.parseCIDR('198.18.0.0/15'),   // Network benchmark tests
  ipaddr.parseCIDR('198.51.100.0/24'), // TEST-NET-2
  ipaddr.parseCIDR('203.0.113.0/24'),  // TEST-NET-3
  ipaddr.parseCIDR('224.0.0.0/4'),     // Multicast
  ipaddr.parseCIDR('240.0.0.0/4'),     // Reserved / Future use
  ipaddr.parseCIDR('255.255.255.255/32') // Broadcast
];

// Blocked IPv6 CIDR ranges per SEC-02
const BLOCKED_IPV6_CIDRS = [
  ipaddr.parseCIDR('::/128'),          // Unspecified
  ipaddr.parseCIDR('::1/128'),         // Loopback
  ipaddr.parseCIDR('fc00::/7'),        // Unique Local (ULA)
  ipaddr.parseCIDR('fe80::/10'),       // Link-Local
  ipaddr.parseCIDR('ff00::/8'),        // Multicast
  ipaddr.parseCIDR('2001:db8::/32'),   // Documentation
  ipaddr.parseCIDR('100::/64')         // Discard-only prefix
];

/**
 * Checks if a parsed IP address (IPv4 or IPv6) falls within any blocked range.
 * @param {string} ipString
 * @returns {boolean} True if the IP is blocked.
 */
export function isIpBlocked(ipString) {
  try {
    let addr = ipaddr.parse(ipString);

    // Normalize IPv4-mapped IPv6 address (e.g., ::ffff:127.0.0.1)
    if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
      addr = addr.toIPv4Address();
    }

    if (addr.kind() === 'ipv4') {
      for (const [range, prefix] of BLOCKED_IPV4_CIDRS) {
        if (addr.match(range, prefix)) {
          return true;
        }
      }
    } else if (addr.kind() === 'ipv6') {
      for (const [range, prefix] of BLOCKED_IPV6_CIDRS) {
        if (addr.match(range, prefix)) {
          return true;
        }
      }
    }

    return false;
  } catch {
    // If not a valid IP string, treat as unsafe
    return true;
  }
}

/**
 * Validates request method according to SEC-07.
 * @param {string} method
 * @returns {string} Uppercase method
 */
export function validateMethod(method) {
  if (!method || typeof method !== 'string') {
    throw {
      code: 'INVALID_INPUT',
      message: 'HTTP method must be a non-empty string.',
      status: 400
    };
  }

  const upper = method.trim().toUpperCase();
  if (!ALLOWED_METHODS.has(upper)) {
    throw {
      code: 'INVALID_INPUT',
      message: `HTTP method '${upper}' is not allowed. Supported methods: ${Array.from(ALLOWED_METHODS).join(', ')}.`,
      status: 400
    };
  }

  return upper;
}

/**
 * Validates and sanitizes the target URL and checks DNS resolution for blocked IPs (SEC-01, SEC-02, SEC-03).
 * @param {string} rawUrl
 * @returns {Promise<{ url: URL, resolvedIps: string[] }>}
 */
export async function validateAndResolveUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw {
      code: 'INVALID_INPUT',
      message: 'Target URL is required and cannot be empty.',
      status: 400
    };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl.trim());
  } catch {
    throw {
      code: 'INVALID_INPUT',
      message: 'Malformed target URL. Please provide a valid absolute URL (e.g., https://api.example.com/data).',
      status: 400
    };
  }

  // SEC-01: Protocol check
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw {
      code: 'INVALID_INPUT',
      message: `Invalid protocol '${parsedUrl.protocol}'. Only 'http:' and 'https:' are supported.`,
      status: 400
    };
  }

  // SEC-01: Reject embedded credentials
  if (parsedUrl.username || parsedUrl.password) {
    throw {
      code: 'INVALID_INPUT',
      message: 'URLs with embedded credentials (user:password@host) are rejected for security.',
      status: 400
    };
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // SEC-02: Check obvious hostname matches
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw {
      code: 'BLOCKED_DESTINATION',
      message: `Target destination '${hostname}' is a reserved or local address and cannot be accessed.`,
      status: 400
    };
  }

  // Check if hostname is directly an IP literal
  if (ipaddr.isValid(hostname)) {
    if (isIpBlocked(hostname)) {
      throw {
        code: 'BLOCKED_DESTINATION',
        message: `Destination IP address '${hostname}' belongs to a private, loopback, or cloud-metadata network range and is blocked.`,
        status: 400
      };
    }
    return { url: parsedUrl, resolvedIps: [hostname] };
  }

  // SEC-03: DNS resolution pre-check. Resolve both IPv4 and IPv6 addresses
  let resolvedAddresses = [];
  try {
    resolvedAddresses = await dns.lookup(hostname, { all: true });
  } catch (err) {
    throw {
      code: 'NETWORK_ERROR',
      message: `Unable to resolve hostname '${hostname}': ${err.code || 'DNS lookup failed'}.`,
      status: 502
    };
  }

  if (!resolvedAddresses || resolvedAddresses.length === 0) {
    throw {
      code: 'NETWORK_ERROR',
      message: `Host '${hostname}' did not resolve to any IP address.`,
      status: 502
    };
  }

  // Check ALL resolved addresses
  const resolvedIps = [];
  for (const item of resolvedAddresses) {
    const ip = item.address;
    resolvedIps.push(ip);
    if (isIpBlocked(ip)) {
      throw {
        code: 'BLOCKED_DESTINATION',
        message: `Destination host '${hostname}' resolved to blocked or private address '${ip}'. Request denied.`,
        status: 400
      };
    }
  }

  return { url: parsedUrl, resolvedIps };
}

/**
 * Validates and filters request headers according to SEC-08.
 * @param {Record<string, any>} headers
 * @returns {Record<string, string>}
 */
export function sanitizeHeaders(headers) {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  const cleanHeaders = {};
  const headerTokenRegex = /^[a-zA-Z0-9!#$%&'*+\-.^_`|~]+$/;

  for (const [key, value] of Object.entries(headers)) {
    if (!key || typeof key !== 'string') continue;
    const trimmedKey = key.trim();
    if (!trimmedKey) continue;

    // Validate header name format
    if (!headerTokenRegex.test(trimmedKey)) {
      throw {
        code: 'INVALID_INPUT',
        message: `Header name '${trimmedKey}' contains invalid characters.`,
        status: 400
      };
    }

    const lowerKey = trimmedKey.toLowerCase();

    // SEC-08: Strip hop-by-hop and proxy control headers
    if (STRIPPED_HEADERS.has(lowerKey)) {
      continue;
    }

    // Convert value to string and validate no CRLF
    const strVal = String(value ?? '').trim();
    if (/[\r\n]/.test(strVal)) {
      throw {
        code: 'INVALID_INPUT',
        message: `Header value for '${trimmedKey}' contains disallowed carriage return or newline characters.`,
        status: 400
      };
    }

    cleanHeaders[trimmedKey] = strVal;
  }

  return cleanHeaders;
}
