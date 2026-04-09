import type { DocumentCategory } from "@/lib/dataset/types";

export interface CachedEmbeddingRecord {
  chunkId: string;
  docId: string;
  title: string;
  documentText: string;
  chunkText: string;
  category: DocumentCategory;
  tags: string[];
  embedding: number[];
}

export interface EmbeddingCache {
  version: number;
  datasetVersion: string;
  datasetHash: string;
  indexedAt: string;
  model: string;
  dimension: number;
  documentCount: number;
  chunkCount: number;
  records: CachedEmbeddingRecord[];
}

export interface IndexStatus {
  ready: boolean;
  indexing: boolean;
  datasetHash: string;
  datasetVersion: string;
  indexedAt: string | null;
  model: string;
  documentCount: number;
  chunkCount: number;
  cachePath: string;
  lastError: string | null;
}
