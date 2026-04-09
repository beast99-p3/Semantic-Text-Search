import type { CachedEmbeddingRecord } from "@/lib/indexing/types";
import { cosineSimilarity } from "@/lib/search/cosine";
import type { SemanticSearchHit } from "@/lib/search/types";

interface ScoreAccumulator {
  id: string;
  title: string;
  text: string;
  category: CachedEmbeddingRecord["category"];
  tags: string[];
  bestScore: number;
  bestChunk: string;
}

function confidenceLabel(score: number, threshold: number): SemanticSearchHit["confidence"] {
  if (score >= Math.max(0.82, threshold + 0.12)) {
    return "high";
  }

  if (score >= Math.max(0.72, threshold + 0.05)) {
    return "medium";
  }

  return "low";
}

export function rankSemanticMatches(
  queryEmbedding: number[],
  records: CachedEmbeddingRecord[],
  topK: number,
  threshold: number
): SemanticSearchHit[] {
  // Collapse chunk-level scores back to the document level so users see one result per document.
  const byDocument = new Map<string, ScoreAccumulator>();

  for (const record of records) {
    const score = cosineSimilarity(queryEmbedding, record.embedding);
    const existing = byDocument.get(record.docId);

    if (!existing || score > existing.bestScore) {
      byDocument.set(record.docId, {
        id: record.docId,
        title: record.title,
        text: record.documentText,
        category: record.category,
        tags: record.tags,
        bestScore: score,
        bestChunk: record.chunkText,
      });
    }
  }

  return [...byDocument.values()]
    .filter((item) => item.bestScore >= threshold)
    .sort((a, b) => b.bestScore - a.bestScore)
    .slice(0, topK)
    .map((item) => {
      const score = Number(item.bestScore.toFixed(4));

      return {
        id: item.id,
        title: item.title,
        text: item.text,
        category: item.category,
        tags: item.tags,
        score,
        // Confidence is just a simple banding on the similarity score for readability.
        confidence: confidenceLabel(score, threshold),
        explanation: `Top semantic chunk: "${item.bestChunk}"`,
      };
    });
}
