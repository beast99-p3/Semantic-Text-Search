import type { DocumentCategory } from "@/lib/dataset/types";

export interface SemanticSearchHit {
  id: string;
  title: string;
  text: string;
  category: DocumentCategory;
  tags: string[];
  score: number;
  confidence: "high" | "medium" | "low";
  explanation: string;
}

export interface SearchInput {
  query: string;
  k: number;
  threshold: number;
  category?: DocumentCategory;
}
