interface RateLimitEntry {
  count: number;
  expiresAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60 * 1000,
};

export const STRICT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000,
};

export function getClientIp(ip?: string | string[] | null): string {
  if (typeof ip === "string") {
    return ip;
  }

  if (Array.isArray(ip) && ip.length > 0) {
    return ip[0];
  }

  return "unknown";
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG
): boolean {
  const now = Date.now();

  const entry = rateLimitStore.get(identifier);

  if (entry && entry.expiresAt > now) {
    entry.count++;

    if (entry.count > config.maxRequests) {
      return false;
    }

    return true;
  }

  rateLimitStore.set(identifier, {
    count: 1,
    expiresAt: now + config.windowMs,
  });

  return true;
}

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

export function getStoreStats() {
  return {
    currentEntries: rateLimitStore.size,
    totalMemoryEstimate: `~${(rateLimitStore.size * 100) / 1024} KB`,
  };
}
