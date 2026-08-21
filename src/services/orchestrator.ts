import { classifyIntent } from "./intentClassifier";
import { agentRegistry } from "../agents/agents";
import type {AgentResult,Intent,OrchestrationResult,} from "../agents/types";
import { getSession, updateSession,} from "../session/sessionManager";

function combineResults( intent: Intent, results: AgentResult[]): string {
  if (results.length === 0) {
    return "I could not find an agent that can handle that request.";
  }

  if (results.length === 1) {
    return results[0].response;
  }

  const sections = results.map((result) => {
    return [
      `===== ${result.agent} =====`,
      result.response,
    ].join("\n");
  });

  return [
    `Combined response for ${intent}:`,
    "",
    ...sections,
  ].join("\n\n");
}

async function runSingleAgent( intent: Exclude<Intent, "mixed" | "unknown">,
  userId: string, query: string): Promise<AgentResult> {
  const agent = agentRegistry[intent];

  if (!agent) {
    throw new Error(
      `No agent registered for intent: ${intent}`
    );
  }

  return agent(userId, query);
}

function buildPendingMarketQuery( userId: string, fallbackQuery: string): string {
  const session = getSession(userId);

  const parts: string[] = [];

  if (session.marketCity) {
    parts.push(`in ${session.marketCity}`);
  }

  if (session.marketZip) {
    parts.push(`ZIP ${session.marketZip}`);
  }

  if (session.marketPropertyType) {
    parts.push(session.marketPropertyType);
  }

  if (session.marketMonths) {
    parts.push(
      `past ${session.marketMonths} months`
    );
  }

  const marketQuery = parts.join(" ").trim();

  return marketQuery || fallbackQuery;
}

function syncPendingMarketFilters( userId: string): void {
  const session = getSession(userId);
  const pendingIntents =  session.pendingIntents ?? [];

  if (!pendingIntents.includes("market") ) {
    return;
  }

  updateSession(userId, {
    marketCity: session.city ?? session.marketCity ?? null,
    marketZip: session.zip ?? session.marketZip ?? null,
    marketPropertyType: session.type ?? session.marketPropertyType ?? null,
    marketMonths: session.marketMonths ?? 24,
  });
}

export async function orchestrate(query: string, userId: string): Promise<OrchestrationResult> {
  const session = getSession(userId);

  const classification =classifyIntent(query, {
    hasActivePropertyConversation: session.awaiting !== null,
    hasActiveMarketConversation: session.marketAwaiting !== null,
    hasPendingEmailDraft: Boolean(session.pendingEmailDraft),
    hasActiveEmailConversation:session.emailAwaiting !== null,
  });

  //console.log("========== WEEK 9 ORCHESTRATOR ==========");

  //console.log( "Query:",query);

 // console.log("Primary intent:",classification.intent);

  //console.log("Detected intents:",classification.intents );

 // console.log("Confidence:",classification.confidence);

  // UNKNOWN

  if (classification.intent === "unknown") {
    return {
      intent: "unknown",
      agents: [],
      response:
        "I'm not sure how to help with that. Try asking about properties, market trends, recommendations, real-estate terms, or email drafts.",
      results: [],
    };
  }

  // MIXED INTENT
  if (classification.intent === "mixed") {
    const runnableIntents = classification.intents.filter((intent): intent is Exclude<
          Intent,"mixed" | "unknown" > =>
          intent === "search" ||
          intent === "market" ||
          intent === "recommend" ||
          intent === "knowledge" ||
          intent === "email"
      );

    const results: AgentResult[] = [];

    // 1. PROPERTY SEARCH RUNS FIRST
    if (runnableIntents.includes("search")) {
      //console.log( "Week 9 mixed query: running propertySearchAgent first...");

      const propertyResult = await runSingleAgent("search",userId,query);

      results.push(propertyResult);

      let updatedSession = getSession(userId);

      // Save all non-search intents and stop.
      if (updatedSession.awaiting !== null) {
        const pendingIntents =runnableIntents.filter((intent): intent is
              | "market"
              | "recommend"
              | "knowledge"
              | "email" =>
              intent !== "search"
          );

        updateSession(userId, {
          pendingIntents,
          pendingQuery: query,

          // Populate the existing Week 5 fields using whatever Week 4 has learned so far.
          marketCity: updatedSession.city ?? updatedSession.marketCity ?? null,
          marketZip: updatedSession.zip ?? updatedSession.marketZip ?? null,
          marketPropertyType: updatedSession.type ?? updatedSession.marketPropertyType ?? null,
          marketMonths: updatedSession.marketMonths ?? 24,
        });

        //console.log( "Week 4 is waiting for:",updatedSession.awaiting);

        //console.log( "Pending intents saved:", pendingIntents);

       // console.log( "Pending original query:",query);

        return {
          intent: "mixed",
          agents: [propertyResult.agent,],
          response:propertyResult.response,
          results: [propertyResult,],
          metadata: {
            confidence:classification.confidence,
            detectedIntents:classification.intents,
            pendingIntents,
            pendingQuery:query,
            awaiting:updatedSession.awaiting,
          },
        };
      }
    }

    // 2. NO PROPERTY FOLLOW-UP NEEDED
    // Run remaining agents now.
    const remainingIntents = runnableIntents.filter((intent) =>intent !== "search" &&
        intent !== "email" );

  // Run non-email agents first.
  if (remainingIntents.length > 0) {
    const remainingResults =
      await Promise.all(
        remainingIntents.map(
          (intent) => {
            const agentQuery =intent === "market" ? buildPendingMarketQuery(
                    userId, query): query;

            return runSingleAgent( intent, userId, agentQuery );
          }
        )
      );

    results.push(...remainingResults);
  }

  // EMAIL MUST RUN LAST.
  // Week 11 reads session.lastResults.
  // Recommendation/property agents must finish first.
  if (runnableIntents.includes("email")) {
    const emailResult = await runSingleAgent("email",userId,query);

    results.push(emailResult);
  }
    const emailResult = results.find((result) =>result.intent === "email");
    const response = emailResult ? emailResult.response : combineResults(
        "mixed", results );
    return {
      intent: "mixed",
      agents: results.map((result) => result.agent ),
      response,
      results,
      metadata: {
        confidence:classification.confidence,
        detectedIntents:classification.intents,
      },
    };
  }

  // SINGLE INTENT
  const result = await runSingleAgent(classification.intent, userId,query);
  const updatedSession = getSession(userId);
  const pendingIntents = updatedSession.pendingIntents ?? [];
  const pendingQuery =updatedSession.pendingQuery ?? null;

  // Week 4 is still asking questions. Keep waiting.

  if (classification.intent === "search" && updatedSession.awaiting !== null) {
    // Keep the existing market fields synchronized
    // with the latest property-search information.
    syncPendingMarketFilters(userId);

    const synchronizedSession = getSession(userId);

    return {
      intent: "search",
      agents: [result.agent,],
      response:result.response,
      results: [result,],
      metadata: {
        confidence:classification.confidence,
        detectedIntents:classification.intents,
        pendingIntents:synchronizedSession.pendingIntents ?? [],
        pendingQuery:synchronizedSession.pendingQuery ?? null,
        awaiting:synchronizedSession.awaiting,
      },
    };
  }

  // Week 4 finished.
  // Run previously pending agents.

  if (classification.intent === "search" && updatedSession.awaiting === null &&
    pendingIntents.length > 0) {
    //console.log("Week 9 property search completed.");
    //console.log("Pending intents:",pendingIntents);

    const pendingResults =
      await Promise.all(
        pendingIntents.map(
          (intent) => {
            const agentQuery = intent === "market" ? buildPendingMarketQuery(
                    userId, pendingQuery ?? query) : pendingQuery ?? query;

           // console.log(`Running pending ${intent} agent with query:`,agentQuery );

            return runSingleAgent(intent,userId,agentQuery);
          }
        )
      );

    // Clear Week 9 pending state
    // after all pending agents finish.
    updateSession(userId, {
      pendingIntents: [],
      pendingQuery: null,

      // Clear Week 5 temporary state as well.
      marketAwaiting: null,
      marketCity: null,
      marketZip: null,
      marketPropertyType: null,
      marketMonths: null,
    });

    const combinedResults = [result,...pendingResults,];
    const emailResult =combinedResults.find((item) =>item.intent === "email");
    const response = emailResult ? emailResult.response : combineResults(
        "mixed", combinedResults );
    return {
      intent: "mixed",
      agents: combinedResults.map((item) =>item.agent),
      response,
      results:combinedResults,
      metadata: {
        confidence:classification.confidence,
        detectedIntents:classification.intents,
        pendingIntents,
        pendingQuery:pendingQuery ?? query,
      },
    };
  }

  // Normal single-intent response
  return {
    intent:classification.intent,
    agents: [result.agent,],
    response:result.response,
    results: [result,],
    metadata: {
      confidence:classification.confidence,
      detectedIntents:classification.intents,
    },
  };
}