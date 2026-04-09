export const DOCUMENT_CATEGORIES = [
  "animals",
  "programming",
  "sports",
  "food",
  "travel",
  "history",
  "technology",
  "health",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export interface DatasetDocument {
  id: string;
  title: string;
  text: string;
  category: DocumentCategory;
  tags: string[];
}
