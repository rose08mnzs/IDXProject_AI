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