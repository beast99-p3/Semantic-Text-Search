import type { DatasetDocument } from "@/lib/dataset/types";

export interface DocumentChunk {
  chunkId: string;
  docId: string;
  title: string;
  chunkText: string;
  documentText: string;
  category: DatasetDocument["category"];
  tags: string[];
}

interface ChunkingOptions {
  maxChars?: number;
  overlapChars?: number;
}

const DEFAULT_MAX_CHARS = 220;
const DEFAULT_OVERLAP = 32;

export function chunkDocument(
  document: DatasetDocument,
  options: ChunkingOptions = {}
): DocumentChunk[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlapChars = options.overlapChars ?? DEFAULT_OVERLAP;

  if (document.text.length <= maxChars) {
    return [
      {
        chunkId: `${document.id}::0`,
        docId: document.id,
        title: document.title,
        chunkText: document.text,
        documentText: document.text,
        category: document.category,
        tags: document.tags,
      },
    ];
  }

  const chunks: DocumentChunk[] = [];
  let index = 0;
  let start = 0;

  while (start < document.text.length) {
    const end = Math.min(document.text.length, start + maxChars);
    chunks.push({
      chunkId: `${document.id}::${index}`,
      docId: document.id,
      title: document.title,
      chunkText: document.text.slice(start, end),
      documentText: document.text,
      category: document.category,
      tags: document.tags,
    });

    if (end >= document.text.length) {
      break;
    }

    start = Math.max(0, end - overlapChars);
    index += 1;
  }

  return chunks;
}
