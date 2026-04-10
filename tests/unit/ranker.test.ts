import { describe, expect, it } from "vitest";
import { rankSemanticMatches } from "@/lib/search/ranker";
import type { CachedEmbeddingRecord } from "@/lib/indexing/types";

const fixtures: CachedEmbeddingRecord[] = [
  {
    chunkId: "a::0",
    docId: "a",
    title: "Dog fetch",
    documentText: "Dogs play fetch",
    chunkText: "Dogs play fetch",
    category: "animals",
    tags: ["dogs"],
    embedding: [1, 0, 0],
  },
  {
    chunkId: "b::0",
    docId: "b",
    title: "Java island",
    documentText: "Java is in Indonesia",
    chunkText: "Java is in Indonesia",
    category: "travel",
    tags: ["java"],
    embedding: [0, 1, 0],
  },
];

describe("rankSemanticMatches", () => {
  it("keeps scores above threshold", () => {
    const ranking = rankSemanticMatches([1, 0, 0], fixtures, 5, 0.5);
    expect(ranking.hits).toHaveLength(1);
    expect(ranking.hits[0].id).toBe("a");
    expect(ranking.hits[0].confidence).toMatch(/high|medium|low/);
    expect(ranking.topRejectedScore).toBeNull();
  });

  it("returns empty list when nothing passes threshold", () => {
    const ranking = rankSemanticMatches([0, 0, 1], fixtures, 5, 0.3);
    expect(ranking.hits).toHaveLength(0);
    expect(ranking.topRejectedScore).toBe(0);
  });
});
