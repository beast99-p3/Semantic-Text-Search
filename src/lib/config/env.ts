import { z } from "zod";

const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(20).optional(),
  GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  SEMANTIC_RELEVANCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.62),
  TOP_K_DEFAULT: z.coerce.number().int().min(1).max(20).default(8),
  CACHE_PATH: z.string().default("data/embeddings-cache.json"),
});

export type ServerEnv = z.infer<typeof envSchema>;

let envCache: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (envCache) {
    return envCache;
  }

  envCache = envSchema.parse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL,
    SEMANTIC_RELEVANCE_THRESHOLD: process.env.SEMANTIC_RELEVANCE_THRESHOLD,
    TOP_K_DEFAULT: process.env.TOP_K_DEFAULT,
    CACHE_PATH: process.env.CACHE_PATH,
  });

  return envCache;
}

export function assertGeminiApiKey(): string {
  const env = getServerEnv();

  if (!env.GEMINI_API_KEY) {
    throw new Error(
      "Missing GEMINI_API_KEY. Add it to .env.local before indexing/searching."
    );
  }

  return env.GEMINI_API_KEY;
}
