interface RateLimitEntry {
  count: number;
  expiresAt: number;
}

export interface RateLimitStore {
  get(identifier: string): RateLimitEntry | undefined;
  set(identifier: string, entry: RateLimitEntry): void;
  delete(identifier: string): void;
  entries(): IterableIterator<[string, RateLimitEntry]>;
  size: number;
}

class InMemoryRateLimitStore implements RateLimitStore {
  private readonly store = new Map<string, RateLimitEntry>();

  get(identifier: string): RateLimitEntry | undefined {
    return this.store.get(identifier);
  }

  set(identifier: string, entry: RateLimitEntry): void {
    this.store.set(identifier, entry);
  }

  delete(identifier: string): void {
    this.store.delete(identifier);
  }

  entries(): IterableIterator<[string, RateLimitEntry]> {
    return this.store.entries();
  }

  get size(): number {
    return this.store.size;
  }
}

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

export interface RateLimiter {
  checkRateLimit(identifier: string, config?: RateLimitConfig): boolean;
  getRateLimitStatus(
    identifier: string,
    config?: RateLimitConfig
  ): {
    remaining: number;
    limit: number;
    resetAt: number;
  };
  cleanupExpiredEntries(): number;
  getStoreStats(): {
    currentEntries: number;
    totalMemoryEstimate: string;
    storeType: string;
  };
}

function createRateLimiter(store: RateLimitStore): RateLimiter {
  return {
    checkRateLimit(identifier: string, config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG): boolean {
      const now = Date.now();

      const entry = store.get(identifier);

      if (entry && entry.expiresAt > now) {
        entry.count += 1;

        if (entry.count > config.maxRequests) {
          return false;
        }

        return true;
      }

      store.set(identifier, {
        count: 1,
        expiresAt: now + config.windowMs,
      });

      return true;
    },

    getRateLimitStatus(
      identifier: string,
      config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG
    ): {
      remaining: number;
      limit: number;
      resetAt: number;
    } {
      const now = Date.now();
      const entry = store.get(identifier);

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
    },

    cleanupExpiredEntries(): number {
      const now = Date.now();
      let cleaned = 0;

      for (const [identifier, entry] of store.entries()) {
        if (entry.expiresAt <= now) {
          store.delete(identifier);
          cleaned += 1;
        }
      }

      return cleaned;
    },

    getStoreStats() {
      return {
        currentEntries: store.size,
        totalMemoryEstimate: `~${(store.size * 100) / 1024} KB`,
        storeType: store instanceof InMemoryRateLimitStore ? "memory" : "custom",
      };
    },
  };
}

const defaultRateLimiter = createRateLimiter(new InMemoryRateLimitStore());

export function getClientIp(ip?: string | string[] | null): string {
  if (typeof ip === "string") {
    return ip;
  }

  if (Array.isArray(ip) && ip.length > 0) {
    return ip[0];
  }

  return "unknown";
}

export { createRateLimiter };

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG
): boolean {
  return defaultRateLimiter.checkRateLimit(identifier, config);
}

export function getRateLimitStatus(
  identifier: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG
): {
  remaining: number;
  limit: number;
  resetAt: number;
} {
  return defaultRateLimiter.getRateLimitStatus(identifier, config);
}

export function cleanupExpiredEntries(): number {
  return defaultRateLimiter.cleanupExpiredEntries();
}

export function getStoreStats() {
  return defaultRateLimiter.getStoreStats();
}
