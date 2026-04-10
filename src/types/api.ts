import type { DocumentCategory } from "@/lib/dataset/types";
import type { IndexStatus } from "@/lib/indexing/types";

export interface SearchResultDto {
  id: string;
  title: string;
  text: string;
  category: DocumentCategory;
  tags: string[];
  score: number;
  confidence: "high" | "medium" | "low";
  explanation: string;
}

export interface SearchApiResponse {
  query: string;
  tookMs: number;
  timing: {
    embeddingMs: number;
    similarityMs: number;
  };
  indexing: IndexStatus;
  results: SearchResultDto[];
  warnings?: string[];
}
