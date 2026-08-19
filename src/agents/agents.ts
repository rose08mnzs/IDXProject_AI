import { parsePropertyQuery } from "../parser/propertyParser";
import {searchActiveListings,} from "../services/listings";
import {rerankListings,} from "../services/semanticSearch";
import { handleWeek4Conversation } from "../skills/week4Skill";
import { week5Skill } from "../skills/week5Skill";
import { week7Skill } from "../skills/week7Skill";
import { week8Skill } from "../skills/week8Skill";

import { getSession } from "../session/sessionManager";

import type {
  AgentResult,
  Intent,
} from "./types";

function extractUserText(message: string): string {
  const wrapped = message.match(/\):\s*(.*)$/s);
  return (wrapped?.[1] ?? message).trim();
}

/**
 * Week 3/4 property search agent.
 *
 * Important:
 * For Week 9 orchestration we use a direct search path
 * instead of forcing the Week 4 conversational prompts.
 * This allows mixed queries such as:
 *
 * "Find homes in Pasadena and tell me whether prices are rising."
 *
 * to immediately return property results.
 */
export async function propertySearchAgent(
  userId: string,
  query: string
): Promise<AgentResult> {
  const userText =
    extractUserText(query);

 /* console.log("========== WEEK 9 PROPERTY SEARCH ==========");
  console.log(
    "User:",
    userText
  );*/

  // --------------------------------------------------
  // Use the existing Week 4 conversational property
  // search workflow.
  //
  // This preserves:
  // - session state
  // - missing city prompts
  // - budget prompts
  // - bedroom prompts
  // - bathroom prompts
  // - property-type prompts
  // - follow-up answers
  // --------------------------------------------------

  const response =
    await handleWeek4Conversation(
      userId,
      userText
    );

  return {
    agent:
      "propertySearchAgent",

    intent:
      "search",

    response,

    metadata: {
      userId,
      delegatedTo:
        "week4Skill",
    },
  };
}

/**
 * Week 5 market statistics agent.
 */
export async function marketStatsAgent(
  userId: string,
  query: string
): Promise<AgentResult> {
  const result = await week5Skill(
    userId,
    query
  );

  return {
    agent: "marketStatsAgent",
    intent: "market",
    response: result.response,
    market: result.report ?? undefined,
    metadata: {
      filters: result.filters ?? undefined,
      userId,
    },
  };
}

/**
 * Week 7 recommendation agent.
 */
export async function recommendationAgent(
  userId: string,
  query: string
): Promise<AgentResult> {
  const session = getSession(userId);

  const result = await week7Skill(
    userId,
    query
  );

  return {
    agent: "recommendationAgent",
    intent: "recommend",
    response: result.response,
    recommendations:
      result.recommendations ?? [],
    metadata: {
      target: result.target ?? null,
      lastSearchResults:
        session.lastResults.length,
      userId,
    },
  };
}

/**
 * Week 8 RAG knowledge agent.
 */
export async function ragAgent(
  userId: string,
  query: string
): Promise<AgentResult> {
  const result = await week8Skill(
    userId,
    query
  );

  return {
    agent: "ragAgent",
    intent: "knowledge",
    response: result.response,
    rag: result.answer ?? undefined,
    metadata: {
      userId,
    },
  };
}

/**
 * Week 9 email agent.
 *
 * This is intentionally DRAFT ONLY because the actual
 * email send/approval workflow belongs to Week 11.
 */
export async function emailDraftAgent(
  userId: string,
  query: string
): Promise<AgentResult> {
  const userText = extractUserText(query);

  const subject =
    /\bmarket\b|\btrend\b|\bprices?\b/i.test(
      userText
    )
      ? "IDX Market Report"
      : "IDX Property Summary";

  const body =
    [
      "Email Draft",
      "",
      `Request: ${userText}`,
      "",
      "This email has been prepared as a draft only.",
      "No email has been sent.",
      "",
      "Week 11 approval workflow will be responsible for explicit confirmation before sending.",
    ].join("\n");

  return {
    agent: "emailDraftAgent",
    intent: "email",
    response: body,
    metadata: {
      status: "pending_approval",
      subject,
      to: null,
      userId,
    },
  };
}

export type AgentFunction = (
  userId: string,
  query: string
) => Promise<AgentResult>;

export const agentRegistry: Record<
  Exclude<Intent, "mixed" | "unknown">,
  AgentFunction
> = {
  search: propertySearchAgent,
  market: marketStatsAgent,
  recommend: recommendationAgent,
  knowledge: ragAgent,
  email: emailDraftAgent,
};