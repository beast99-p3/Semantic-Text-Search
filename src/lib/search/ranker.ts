import type { CachedEmbeddingRecord } from "@/lib/indexing/types";
import type { SemanticSearchHit } from "@/lib/search/types";

export interface RankingDiagnostics {
  hits: SemanticSearchHit[];
  topRejectedScore: number | null;
}

interface ScoreAccumulator {
  id: string;
  title: string;
  text: string;
  category: CachedEmbeddingRecord["category"];
  tags: string[];
  bestScore: number;
  bestChunk: string;
}

function vectorMagnitude(values: number[]): number {
  let sumSquares = 0;

  for (let i = 0; i < values.length; i += 1) {
    sumSquares += values[i] * values[i];
  }

  return Math.sqrt(sumSquares);
}

function cosineWithKnownMagnitudes(
  a: number[],
  magnitudeA: number,
  b: number[],
  magnitudeB: number
): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length || magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  let dot = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
  }

  return dot / (magnitudeA * magnitudeB);
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
): RankingDiagnostics {
  // Collapse chunk-level scores back to the document level so users see one result per document.
  const byDocument = new Map<string, ScoreAccumulator>();
  const queryMagnitude = vectorMagnitude(queryEmbedding);

  for (const record of records) {
    const magnitude = record.embeddingMagnitude ?? vectorMagnitude(record.embedding);

    // Backward-compatible migration path for existing cache files missing embeddingMagnitude.
    if (record.embeddingMagnitude === undefined) {
      record.embeddingMagnitude = magnitude;
    }

    const score = cosineWithKnownMagnitudes(
      queryEmbedding,
      queryMagnitude,
      record.embedding,
      magnitude
    );
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

  const passing: ScoreAccumulator[] = [];
  let topRejectedScore: number | null = null;

  for (const item of byDocument.values()) {
    if (item.bestScore >= threshold) {
      passing.push(item);
      continue;
    }

    if (topRejectedScore === null || item.bestScore > topRejectedScore) {
      topRejectedScore = item.bestScore;
    }
  }

  passing.sort((a, b) => b.bestScore - a.bestScore);
  const topPassing = passing.slice(0, topK);

  const hits = topPassing.map((item) => {
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

  return {
    hits,
    topRejectedScore: hits.length === 0 && topRejectedScore !== null
      ? Number(topRejectedScore.toFixed(4))
      : null,
  };
}
