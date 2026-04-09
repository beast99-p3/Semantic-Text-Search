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
    const hits = rankSemanticMatches([1, 0, 0], fixtures, 5, 0.5);
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe("a");
    expect(hits[0].confidence).toMatch(/high|medium|low/);
  });

  it("returns empty list when nothing passes threshold", () => {
    const hits = rankSemanticMatches([0, 0, 1], fixtures, 5, 0.3);
    expect(hits).toHaveLength(0);
  });
});
