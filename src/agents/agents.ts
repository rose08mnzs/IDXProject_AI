import { parsePropertyQuery } from "../parser/propertyParser";
import {searchActiveListings,} from "../services/listings";
import {rerankListings,} from "../services/semanticSearch";
import { handleWeek4Conversation } from "../skills/week4Skill";
import { week5Skill } from "../skills/week5Skill";
import { week7Skill } from "../skills/week7Skill";
import { week8Skill } from "../skills/week8Skill";
import { week11Skill } from "../skills/week11Skill";

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

/*Week 5 market statistics agent.
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

/*Week 7 recommendation agent.
 */
export async function recommendationAgent(
  userId: string,
  query: string
): Promise<AgentResult> {
  const result = await week7Skill( userId, query);
  const updatedSession =getSession(userId);

  return {
    agent:"recommendationAgent",
    intent:"recommend",
    response:result.response,
    recommendations:result.recommendations ?? [],
    metadata: {
      target:result.target ?? null,
      lastSearchResults: updatedSession.lastResults.length,
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
 * Week 11 email agent.
 *
 * This agent NEVER sends directly.
 * It creates a draft and waits for explicit
 * approval through the Week 11 safety gate.
 */
export async function emailDraftAgent(
  userId: string,
  query: string
): Promise<AgentResult> {
  const result =
    await week11Skill(
      userId,
      query
    );

  return {
    agent:
      "emailDraftAgent",

    intent:
      "email",

    response:
      result.response,

    metadata: {
      status:
        result.draft?.status ??
        "none",

      draftId:
        result.draft?.id ??
        null,

      subject:
        result.draft?.subject ??
        null,

      recipient:
        result.draft?.to ??
        null,

      purpose:
        result.draft?.purpose ??
        null,

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