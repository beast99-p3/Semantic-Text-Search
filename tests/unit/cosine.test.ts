import { describe, expect, it } from "vitest";
import { cosineSimilarity } from "@/lib/search/cosine";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it("returns 0 for mismatched vector lengths", () => {
    expect(cosineSimilarity([1, 2], [1])).toBe(0);
  });
});
