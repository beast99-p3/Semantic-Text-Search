import { getServerEnv } from "@/lib/config/env";
import { DATASET_DOCUMENTS, DATASET_VERSION } from "@/lib/dataset/documents";
import { chunkDocument } from "@/lib/indexing/chunking";
import {
  getEmbeddingCachePath,
  readEmbeddingCache,
  writeEmbeddingCache,
} from "@/lib/indexing/cache";
import { embedText } from "@/lib/indexing/embedder";
import type { CachedEmbeddingRecord, EmbeddingCache, IndexStatus } from "@/lib/indexing/types";
import { sha256 } from "@/lib/utils/hash";

let indexingPromise: Promise<EmbeddingCache> | null = null;
let lastError: string | null = null;
let inMemoryCache: EmbeddingCache | null = null;

function computeDatasetHash(): string {
  // The hash only tracks document content and metadata, not embeddings.
  const payload = DATASET_DOCUMENTS.map((doc) => ({
    id: doc.id,
    title: doc.title,
    text: doc.text,
    category: doc.category,
    tags: doc.tags,
  }));

  return sha256(JSON.stringify(payload));
}

async function buildFreshCache(datasetHash: string): Promise<EmbeddingCache> {
  const env = getServerEnv();
  const chunks = DATASET_DOCUMENTS.flatMap((doc) => chunkDocument(doc));
  const records: CachedEmbeddingRecord[] = [];

  // Each chunk is embedded once and then persisted locally for reuse.
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const embedding = await embedText(chunk.chunkText, {
      purpose: "document",
      title: chunk.title,
    });

    records.push({
      chunkId: chunk.chunkId,
      docId: chunk.docId,
      title: chunk.title,
      documentText: chunk.documentText,
      chunkText: chunk.chunkText,
      category: chunk.category,
      tags: chunk.tags,
      embedding,
    });

    if ((index + 1) % 10 === 0) {
      console.info(`[indexer] embedded ${index + 1}/${chunks.length} chunks`);
    }
  }

  const cache: EmbeddingCache = {
    version: 1,
    datasetVersion: DATASET_VERSION,
    datasetHash,
    indexedAt: new Date().toISOString(),
    model: env.GEMINI_EMBEDDING_MODEL,
    dimension: records[0]?.embedding.length ?? 0,
    documentCount: DATASET_DOCUMENTS.length,
    chunkCount: chunks.length,
    records,
  };

  await writeEmbeddingCache(cache);
  return cache;
}

export async function ensureIndexReady(force = false): Promise<EmbeddingCache> {
  if (indexingPromise) {
    return indexingPromise;
  }

  // Reindex only when the dataset changes or the UI explicitly requests it.
  indexingPromise = (async () => {
    const datasetHash = computeDatasetHash();

    if (!force) {
      const cached = inMemoryCache ?? (await readEmbeddingCache());

      if (cached && cached.datasetHash === datasetHash) {
        inMemoryCache = cached;
        return cached;
      }
    }

    const cache = await buildFreshCache(datasetHash);
    inMemoryCache = cache;
    return cache;
  })();

  try {
    const cache = await indexingPromise;
    lastError = null;
    return cache;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown indexing error";
    lastError = message;
    throw error;
  } finally {
    indexingPromise = null;
  }
}

export async function getIndexStatus(): Promise<IndexStatus> {
  const datasetHash = computeDatasetHash();
  const env = getServerEnv();
  const cache = inMemoryCache ?? (await readEmbeddingCache());

  if (cache && cache.datasetHash === datasetHash) {
    inMemoryCache = cache;
  }

  const ready = Boolean(cache && cache.datasetHash === datasetHash);

  return {
    ready,
    indexing: Boolean(indexingPromise),
    datasetHash,
    datasetVersion: DATASET_VERSION,
    indexedAt: ready ? cache?.indexedAt ?? null : null,
    model: env.GEMINI_EMBEDDING_MODEL,
    documentCount: DATASET_DOCUMENTS.length,
    chunkCount: ready ? cache?.chunkCount ?? 0 : 0,
    cachePath: getEmbeddingCachePath(),
    lastError,
  };
}

export async function getCurrentIndex(): Promise<EmbeddingCache> {
  const cache = await ensureIndexReady();
  return cache;
}
