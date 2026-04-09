import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/search/service", () => ({
  semanticSearch: vi.fn(),
}));

vi.mock("@/lib/indexing/indexer", () => ({
  getIndexStatus: vi.fn(),
}));

import { getIndexStatus } from "@/lib/indexing/indexer";
import { semanticSearch } from "@/lib/search/service";
import { GET } from "@/app/api/search/route";

const mockedStatus = {
  ready: true,
  indexing: false,
  datasetHash: "hash",
  datasetVersion: "v1",
  indexedAt: new Date().toISOString(),
  model: "gemini-embedding-001",
  documentCount: 80,
  chunkCount: 80,
  cachePath: "data/embeddings-cache.json",
  lastError: null,
};

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getIndexStatus).mockResolvedValue(mockedStatus);
  });

  it("returns 400 for empty query", async () => {
    const request = new NextRequest("http://localhost:3000/api/search?q=");
    const response = await GET(request);

    expect(response.status).toBe(400);
  });

  it("returns structured search payload", async () => {
    vi.mocked(semanticSearch).mockResolvedValue({
      results: [
        {
          id: "d001",
          title: "Backend language Java",
          text: "Java is a popular backend language used for enterprise APIs and microservices.",
          category: "programming",
          tags: ["java"],
          score: 0.88,
          confidence: "high",
          explanation: "Top semantic chunk",
        },
      ],
    });

    const request = new NextRequest("http://localhost:3000/api/search?q=enterprise%20api");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].score).toBe(0.88);
  });
});
