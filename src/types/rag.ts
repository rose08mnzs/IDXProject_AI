export type RagSourceType =
  | "real-estate-primer"
  | "trestle-metadata"
  | "week5-market"
  | "handbook-schema";

export interface RagSourceDoc {
  title: string;
  content: string;
  sourceType: RagSourceType;
  metadata?: {
    path?: string;
    pages?: string;
  };
}

export interface RagChunk {
  source: string;
  sourceType: RagSourceType;
  chunk: string;
  chunkIndex: number;
  embedding: number[];
  metadata?: {
    path?: string;
    pages?: string;
  };
}

export interface RagSourceCitation {
  source: string;
  sourceType: RagSourceType;
  chunkIndex: number;
  pages?: string;
}

export interface RagAnswer {
  question: string;
  answer: string;
  confidence: "low" | "medium" | "high";
  sources: RagSourceCitation[];
}