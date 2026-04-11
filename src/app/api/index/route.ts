import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureIndexReady, getIndexStatus } from "@/lib/indexing/indexer";
import {
  checkRateLimit,
  getRateLimitStatus,
  getClientIp,
  STRICT_RATE_LIMIT_CONFIG,
} from "@/lib/utils/rate-limiter";

const bodySchema = z
  .object({
    force: z.boolean().optional(),
  })
  .optional();

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const clientIp = getClientIp(request.headers.get("x-forwarded-for"));
    const isAllowed = checkRateLimit(clientIp, STRICT_RATE_LIMIT_CONFIG);

    if (!isAllowed) {
      const status = getRateLimitStatus(clientIp, STRICT_RATE_LIMIT_CONFIG);
      const response = NextResponse.json(
        {
          ok: false,
          error: "Rate limit exceeded. Too many requests.",
          retryAfter: Math.ceil((status.resetAt - Date.now()) / 1000),
        },
        { status: 429 }
      );

      // Add rate limit headers
      response.headers.set("X-RateLimit-Limit", String(STRICT_RATE_LIMIT_CONFIG.maxRequests));
      response.headers.set("X-RateLimit-Remaining", String(status.remaining));
      response.headers.set("X-RateLimit-Reset", String(Math.ceil(status.resetAt / 1000)));
      response.headers.set("Retry-After", String(Math.ceil((status.resetAt - Date.now()) / 1000)));

      return response;
    }

    const body = request.headers.get("content-type")?.includes("application/json")
      ? bodySchema.parse(await request.json())
      : undefined;

    await ensureIndexReady(Boolean(body?.force));
    const status = await getIndexStatus();

    const rateLimitStatus = getRateLimitStatus(clientIp, STRICT_RATE_LIMIT_CONFIG);
    const jsonResponse = NextResponse.json(
      {
        ok: true,
        status,
      },
      { status: 200 }
    );

    // Add rate limit headers
    jsonResponse.headers.set("X-RateLimit-Limit", String(STRICT_RATE_LIMIT_CONFIG.maxRequests));
    jsonResponse.headers.set("X-RateLimit-Remaining", String(rateLimitStatus.remaining));
    jsonResponse.headers.set("X-RateLimit-Reset", String(Math.ceil(rateLimitStatus.resetAt / 1000)));

    return jsonResponse;
  } catch (error) {
    const status = await getIndexStatus();

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Indexing failed",
        status,
      },
      { status: 500 }
    );
  }
}
