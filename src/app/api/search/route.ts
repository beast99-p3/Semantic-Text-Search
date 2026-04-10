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

interface QueryValidationResult {
  normalizedQuery: string;
  warnings: string[];
  error?: string;
}

function validateQuery(rawQuery: string): QueryValidationResult {
  const normalizedQuery = rawQuery.trim().replace(/\s+/g, " ");
  const warnings: string[] = [];

  if (!normalizedQuery) {
    return {
      normalizedQuery,
      warnings,
      error: "Query is required",
    };
  }

  if (/[\u0000-\u001F\u007F]/.test(normalizedQuery)) {
    return {
      normalizedQuery,
      warnings,
      error: "Query contains unsupported control characters.",
    };
  }

  if (/^[\p{P}\p{S}\s]+$/u.test(normalizedQuery)) {
    return {
      normalizedQuery,
      warnings,
      error: "Query should include letters or numbers, not only symbols.",
    };
  }

  const letters = [...normalizedQuery.matchAll(/\p{L}/gu)].length;
  const latinLetters = [...normalizedQuery.matchAll(/\p{Script=Latin}/gu)].length;
  const symbols = [...normalizedQuery.matchAll(/[\p{P}\p{S}]/gu)].length;

  if (normalizedQuery.length > 220) {
    warnings.push("Long queries may reduce precision. Consider shortening the query.");
  }

  if (normalizedQuery.length > 0 && symbols / normalizedQuery.length > 0.3) {
    warnings.push("Query has many special characters. Results may be less stable.");
  }

  if (letters > 0 && latinLetters / letters < 0.4) {
    warnings.push("Non-English query detected. Semantic matching is supported but may vary by language.");
  }

  return {
    normalizedQuery,
    warnings,
  };
}

export async function GET(request: NextRequest) {
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

    const queryValidation = validateQuery(parsed.data.q);
    if (queryValidation.error) {
      const status = await getIndexStatus();

      return NextResponse.json(
        {
          error: queryValidation.error,
          warnings: queryValidation.warnings,
          indexing: status,
        },
        { status: 400 }
      );
    }

    const env = getServerEnv();
    const threshold = parsed.data.threshold ?? env.SEMANTIC_RELEVANCE_THRESHOLD;
    const topK = parsed.data.k ?? env.TOP_K_DEFAULT;

    const payload = await semanticSearch({
      query: queryValidation.normalizedQuery,
      k: topK,
      threshold,
      category: parsed.data.category,
    });

    const status = await getIndexStatus();
    const response: SearchApiResponse = {
      query: queryValidation.normalizedQuery,
      tookMs: payload.timing.embeddingMs + payload.timing.similarityMs,
      timing: payload.timing,
      cacheHit: payload.cacheHit,
      topRejectedScore: payload.topRejectedScore,
      indexing: status,
      results: payload.results,
      warnings: queryValidation.warnings,
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
