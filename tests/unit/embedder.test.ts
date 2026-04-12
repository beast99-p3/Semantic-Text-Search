import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/env", () => ({
  assertGeminiApiKey: vi.fn(() => "test-api-key"),
  getServerEnv: vi.fn(() => ({
    GEMINI_API_KEY: "test-api-key",
    GEMINI_EMBEDDING_MODEL: "gemini-embedding-001",
    SEMANTIC_RELEVANCE_THRESHOLD: 0.62,
    TOP_K_DEFAULT: 8,
    CACHE_PATH: "data/embeddings-cache.json",
  })),
}));

import { embedText } from "@/lib/indexing/embedder";

describe("embedText", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("sends the Gemini API key in a header instead of the URL", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        embedding: {
          values: [0.1, 0.2, 0.3],
        },
      }),
    });

    await embedText("hello world");

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain("key=test-api-key");
    expect(String(url)).toContain("generativelanguage.googleapis.com");
    expect(init).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        "Content-Type": "application/json",
        "x-goog-api-key": "test-api-key",
      }),
    });
  });
});
