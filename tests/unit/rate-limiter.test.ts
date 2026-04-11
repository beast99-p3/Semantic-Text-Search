import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  getRateLimitStatus,
  getClientIp,
  cleanupExpiredEntries,
  DEFAULT_RATE_LIMIT_CONFIG,
  STRICT_RATE_LIMIT_CONFIG,
} from "@/lib/utils/rate-limiter";

describe("Rate Limiter", () => {
  beforeEach(() => {
    // Clean up between tests by adding a slight delay to allow time to pass
    cleanupExpiredEntries();
  });

  describe("getClientIp", () => {
    it("should extract IP from string", () => {
      expect(getClientIp("192.168.1.1")).toBe("192.168.1.1");
    });

    it("should extract first IP from array", () => {
      expect(getClientIp(["192.168.1.1", "10.0.0.1"])).toBe("192.168.1.1");
    });

    it("should return 'unknown' for invalid input", () => {
      expect(getClientIp(null)).toBe("unknown");
      expect(getClientIp(undefined)).toBe("unknown");
      expect(getClientIp([])).toBe("unknown");
    });
  });

  describe("checkRateLimit", () => {
    it("should allow first request", () => {
      const result = checkRateLimit("ip1", DEFAULT_RATE_LIMIT_CONFIG);
      expect(result).toBe(true);
    });

    it("should allow requests within limit", () => {
      const config = { maxRequests: 5, windowMs: 60000 };
      for (let i = 0; i < 5; i++) {
        expect(checkRateLimit("ip2", config)).toBe(true);
      }
    });

    it("should block requests exceeding limit", () => {
      const config = { maxRequests: 3, windowMs: 60000 };
      // Use a unique identifier to avoid test pollution
      const identifier = `test-${Math.random()}`;
      for (let i = 0; i < 3; i++) {
        checkRateLimit(identifier, config);
      }
      // 4th request should be blocked
      expect(checkRateLimit(identifier, config)).toBe(false);
    });

    it("should use default config when not provided", () => {
      const identifier = `default-${Math.random()}`;
      // Should allow up to DEFAULT_RATE_LIMIT_CONFIG.maxRequests requests
      let result = true;
      for (let i = 0; i < DEFAULT_RATE_LIMIT_CONFIG.maxRequests; i++) {
        result = checkRateLimit(identifier);
      }
      expect(result).toBe(true);

      // Next request should be blocked
      expect(checkRateLimit(identifier)).toBe(false);
    });
  });

  describe("getRateLimitStatus", () => {
    it("should return full limit for new client", () => {
      const identifier = `status-${Math.random()}`;
      const status = getRateLimitStatus(identifier, STRICT_RATE_LIMIT_CONFIG);
      expect(status.remaining).toBe(STRICT_RATE_LIMIT_CONFIG.maxRequests);
      expect(status.limit).toBe(STRICT_RATE_LIMIT_CONFIG.maxRequests);
    });

    it("should decrease remaining after requests", () => {
      const config = { maxRequests: 5, windowMs: 60000 };
      const identifier = `status2-${Math.random()}`;
      checkRateLimit(identifier, config);
      const status = getRateLimitStatus(identifier, config);
      expect(status.remaining).toBe(4);
    });

    it("should show reset time", () => {
      const identifier = `status3-${Math.random()}`;
      const beforeCheck = Date.now();
      checkRateLimit(identifier, { maxRequests: 10, windowMs: 30000 });
      const status = getRateLimitStatus(identifier, { maxRequests: 10, windowMs: 30000 });
      const afterCheck = Date.now();

      // Reset time should be approximately 30 seconds in the future
      expect(status.resetAt).toBeGreaterThanOrEqual(beforeCheck + 30000);
      expect(status.resetAt).toBeLessThanOrEqual(afterCheck + 30000);
    });
  });

  describe("cleanupExpiredEntries", () => {
    it("should clean up old entries", async () => {
      const config = { maxRequests: 5, windowMs: 1 }; // 1ms window
      const identifier = `cleanup-${Math.random()}`;
      checkRateLimit(identifier, config);

      // Wait for entry to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      const cleaned = cleanupExpiredEntries();
      expect(cleaned).toBeGreaterThan(0);

      // Entry should be reset now
      const status = getRateLimitStatus(identifier, config);
      expect(status.remaining).toBe(config.maxRequests);
    });
  });
});
