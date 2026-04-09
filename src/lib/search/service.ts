import type { DocumentCategory } from "@/lib/dataset/types";
import { embedText } from "@/lib/indexing/embedder";
import { ensureIndexReady } from "@/lib/indexing/indexer";
import { rankSemanticMatches } from "@/lib/search/ranker";
import type { SearchInput } from "@/lib/search/types";

export interface SearchResponseModel {
  results: Awaited<ReturnType<typeof rankSemanticMatches>>;
}

function filterByCategory<T extends { category: DocumentCategory }>(
  items: T[],
  category?: DocumentCategory
): T[] {
  if (!category) {
    return items;
  }

  return items.filter((item) => item.category === category);
}

export async function semanticSearch(input: SearchInput): Promise<SearchResponseModel> {
  const trimmedQuery = input.query.trim();
  const index = await ensureIndexReady();
  const queryEmbedding = await embedText(trimmedQuery, { purpose: "query" });
  const candidateRecords = filterByCategory(index.records, input.category);

  const results = rankSemanticMatches(
    queryEmbedding,
    candidateRecords,
    input.k,
    input.threshold
  );

  return {
    results,
  };
}
