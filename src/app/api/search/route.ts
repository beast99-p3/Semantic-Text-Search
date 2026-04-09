import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DOCUMENT_CATEGORIES } from "@/lib/dataset/types";
import { getServerEnv } from "@/lib/config/env";
import { getIndexStatus } from "@/lib/indexing/indexer";
import { semanticSearch } from "@/lib/search/service";
import type { SearchApiResponse } from "@/types/api";

const querySchema = z.object({
  q: z.string().trim().min(1, "Query is required").max(300, "Query is too long"),
  k: z.coerce.number().int().min(1).max(20).optional(),
  threshold: z.coerce.number().min(0).max(1).optional(),
  category: z.enum(DOCUMENT_CATEGORIES).optional(),
});

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = querySchema.safeParse(params);

    if (!parsed.success) {
      const status = await getIndexStatus();

      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid query",
          indexing: status,
        },
        { status: 400 }
      );
    }

    const env = getServerEnv();
    const threshold = parsed.data.threshold ?? env.SEMANTIC_RELEVANCE_THRESHOLD;
    const topK = parsed.data.k ?? env.TOP_K_DEFAULT;

    const payload = await semanticSearch({
      query: parsed.data.q,
      k: topK,
      threshold,
      category: parsed.data.category,
    });

    const status = await getIndexStatus();
    const response: SearchApiResponse = {
      query: parsed.data.q,
      tookMs: Date.now() - startedAt,
      indexing: status,
      results: payload.results,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const status = await getIndexStatus();

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Search failed",
        indexing: status,
      },
      { status: 503 }
    );
  }
}
