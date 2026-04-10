import type { DocumentCategory } from "@/lib/dataset/types";
import { embedText } from "@/lib/indexing/embedder";
import { ensureIndexReady } from "@/lib/indexing/indexer";
import { rankSemanticMatches } from "@/lib/search/ranker";
import type { SearchInput } from "@/lib/search/types";

export interface SearchResponseModel {
  results: Awaited<ReturnType<typeof rankSemanticMatches>>["hits"];
  timing: {
    embeddingMs: number;
    similarityMs: number;
  };
  cacheHit: boolean;
  topRejectedScore: number | null;
}

interface SearchCacheEntry {
  expiresAt: number;
  results: SearchResponseModel["results"];
  topRejectedScore: SearchResponseModel["topRejectedScore"];
}

const SEARCH_CACHE_TTL_MS = 30_000;
const SEARCH_CACHE_MAX_ENTRIES = 120;
const searchResponseCache = new Map<string, SearchCacheEntry>();

function filterByCategory<T extends { category: DocumentCategory }>(
  items: T[],
  category?: DocumentCategory
): T[] {
  if (!category) {
    return items;
  }

  return items.filter((item) => item.category === category);
}

function buildSearchCacheKey(indexHash: string, input: SearchInput, trimmedQuery: string): string {
  return [
    indexHash,
    trimmedQuery.toLowerCase(),
    input.category ?? "all",
    String(input.k),
    String(input.threshold),
  ].join("::");
}

function pruneExpiredSearchEntries(now: number): void {
  for (const [key, entry] of searchResponseCache.entries()) {
    if (entry.expiresAt <= now) {
      searchResponseCache.delete(key);
    }
  }
}

function cacheSearchResults(
  key: string,
  results: SearchResponseModel["results"],
  topRejectedScore: SearchResponseModel["topRejectedScore"],
  now: number
): void {
  searchResponseCache.set(key, {
    expiresAt: now + SEARCH_CACHE_TTL_MS,
    results,
    topRejectedScore,
  });

  while (searchResponseCache.size > SEARCH_CACHE_MAX_ENTRIES) {
    const firstKey = searchResponseCache.keys().next().value;
    if (!firstKey) {
      break;
    }

    searchResponseCache.delete(firstKey);
  }
}

export async function semanticSearch(input: SearchInput): Promise<SearchResponseModel> {
  const trimmedQuery = input.query.trim();
  const index = await ensureIndexReady();
  const now = Date.now();

  pruneExpiredSearchEntries(now);

  const cacheKey = buildSearchCacheKey(index.datasetHash, input, trimmedQuery);
  const cached = searchResponseCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return {
      results: cached.results,
      timing: {
        embeddingMs: 0,
        similarityMs: 0,
      },
      cacheHit: true,
      topRejectedScore: cached.topRejectedScore,
    };
  }

  const embeddingStartedAt = Date.now();
  const queryEmbedding = await embedText(trimmedQuery, { purpose: "query" });
  const embeddingMs = Date.now() - embeddingStartedAt;
  const candidateRecords = filterByCategory(index.records, input.category);

  const similarityStartedAt = Date.now();
  const ranking = rankSemanticMatches(
    queryEmbedding,
    candidateRecords,
    input.k,
    input.threshold
  );
  const results = ranking.hits;
  const similarityMs = Date.now() - similarityStartedAt;

  cacheSearchResults(cacheKey, results, ranking.topRejectedScore, now);

  return {
    results,
    timing: {
      embeddingMs,
      similarityMs,
    },
    cacheHit: false,
    topRejectedScore: ranking.topRejectedScore,
  };
}
