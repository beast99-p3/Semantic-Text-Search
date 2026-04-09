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

  it("returns 400 for symbol-only query", async () => {
    const request = new NextRequest("http://localhost:3000/api/search?q=%40%40%40%23%23%23");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/letters or numbers/i);
  });

  it("includes warnings for non-English queries", async () => {
    vi.mocked(semanticSearch).mockResolvedValue({ results: [] });

    const request = new NextRequest("http://localhost:3000/api/search?q=%E0%A4%A8%E0%A4%AE%E0%A4%B8%E0%A5%8D%E0%A4%A4%E0%A5%87%20%E0%A4%A6%E0%A5%81%E0%A4%A8%E0%A4%BF%E0%A4%AF%E0%A4%BE");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(body.warnings)).toBe(true);
    expect(body.warnings[0]).toMatch(/non-english query detected/i);
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
    expect(body.warnings).toEqual([]);
  });
});
