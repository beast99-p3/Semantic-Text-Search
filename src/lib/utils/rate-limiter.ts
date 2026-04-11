/**
 * In-memory rate limiter for API endpoints.
 * Tracks requests per IP address with configurable time windows.
 */

interface RateLimitEntry {
  count: number;
  expiresAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Configuration for rate limiting
 */
export interface RateLimitConfig {
  /** Maximum requests allowed per window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

/**
 * Default rate limit config: 30 requests per minute
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60 * 1000, // 1 minute
};

/**
 * Stricter rate limit for expensive operations: 10 requests per minute
 */
export const STRICT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
};

/**
 * Extract client IP address from request headers
 */
export function getClientIp(ip?: string | string[] | null): string {
  if (typeof ip === "string") {
    return ip;
  }

  if (Array.isArray(ip) && ip.length > 0) {
    return ip[0];
  }

  return "unknown";
}

/**
 * Check if a client has exceeded rate limit
 * @returns true if under limit (request allowed), false if over limit
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG
): boolean {
  const now = Date.now();

  // Clean up expired entries
  const entry = rateLimitStore.get(identifier);

  if (entry && entry.expiresAt > now) {
    // Entry still valid, increment count
    entry.count++;

    if (entry.count > config.maxRequests) {
      return false; // Over limit
    }

    return true; // Under limit
  }

  // Create new entry
  rateLimitStore.set(identifier, {
    count: 1,
    expiresAt: now + config.windowMs,
  });

  return true; // First request, always allowed
}

/**
 * Get current rate limit status for a client
 */
export function getRateLimitStatus(
  identifier: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG
): {
  remaining: number;
  limit: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || entry.expiresAt <= now) {
    return {
      remaining: config.maxRequests,
      limit: config.maxRequests,
      resetAt: now + config.windowMs,
    };
  }

  return {
    remaining: Math.max(0, config.maxRequests - entry.count),
    limit: config.maxRequests,
    resetAt: entry.expiresAt,
  };
}

/**
 * Cleanup old entries from store (call periodically to prevent memory leaks)
 */
export function cleanupExpiredEntries(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [identifier, entry] of rateLimitStore.entries()) {
    if (entry.expiresAt <= now) {
      rateLimitStore.delete(identifier);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Get store statistics (for monitoring)
 */
export function getStoreStats() {
  return {
    currentEntries: rateLimitStore.size,
    totalMemoryEstimate: `~${(rateLimitStore.size * 100) / 1024} KB`, // Rough estimate
  };
}
