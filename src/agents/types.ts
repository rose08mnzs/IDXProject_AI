export type Intent =
  | "search"
  | "market"
  | "recommend"
  | "knowledge"
  | "email"
  | "mixed"
  | "unknown";

export interface AgentSource {
  source: string;
  type?: string;
}
export type EmailDraftStatus =
  | "pending_approval"
  | "approved"
  | "sent"
  | "cancelled";

export type EmailDraftPurpose =
  | "listing_alert"
  | "market_report"
  | "property_summary"
  | "recommendation_digest";

export interface EmailDraft {
  id: string;
  to: string;
  subject: string;
  body: string;
  html: string;
  purpose: EmailDraftPurpose;
  status: EmailDraftStatus;
  createdAt: number;
  approvedAt?: number;
  sentAt?: number;
}

export interface AgentResult {
  agent: string;
  intent: Intent;
  response: string;

  listings?: unknown[];
  market?: unknown;
  recommendations?: unknown[];
  rag?: unknown;

  metadata?: Record<string, unknown>;
  sources?: AgentSource[];
}

export interface OrchestrationResult {
  intent: Intent;
  agents: string[];
  response: string;

  results: AgentResult[];
  metadata?: Record<string, unknown>;
}