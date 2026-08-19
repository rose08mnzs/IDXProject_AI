import assert from "node:assert/strict";
import { closeDb } from "../../config/db";

import {
  classifyIntent,
} from "../services/intentClassifier";

import {
  orchestrate,
} from "../services/orchestrator";

import {
  getSession,
  resetSession,
} from "../session/sessionManager";

async function testIntentClassifier() {
  const search =
    classifyIntent(
      "Find 3 bedroom condos in Irvine under $1.5M"
    );

  assert.equal(
    search.intent,
    "search"
  );

  const market =
    classifyIntent(
      "Is the Pasadena housing market rising?"
    );

  assert.equal(
    market.intent,
    "market"
  );

  const recommendation =
    classifyIntent(
      "Show me similar homes to this listing"
    );

  assert.equal(
    recommendation.intent,
    "recommend"
  );

  const knowledge =
    classifyIntent(
      "What does DOM mean?"
    );

  assert.equal(
    knowledge.intent,
    "knowledge"
  );

  const email =
    classifyIntent(
      "Draft an email with the Pasadena market report"
    );

  assert.equal(
    email.intent,
    "email"
  );

  const mixed =
    classifyIntent(
      "Find affordable homes in Pasadena and tell me whether prices are rising"
    );

  assert.equal(
    mixed.intent,
    "mixed"
  );

  console.log(
    "✓ Intent classification tests passed"
  );
}

async function testOrchestratorSearch() {
  const userId =
    "week9-test-user-search";

  resetSession(
    userId
  );

  const result =
    await orchestrate(
      "Find 3 bedroom homes in Irvine under $1.5M",
      userId
    );

  assert.equal(
    result.intent,
    "search"
  );

  assert.ok(
    result.agents.includes(
      "propertySearchAgent"
    )
  );

  assert.ok(
    result.response.length > 0
  );

  console.log(
    "✓ Search orchestration passed"
  );
}

async function testOrchestratorMarket() {
  const userId =
    "week9-test-user-market";

  resetSession(
    userId
  );

  const result =
    await orchestrate(
      "Tell me about the Pasadena market",
      userId
    );

  assert.equal(
    result.intent,
    "market"
  );

  assert.ok(
    result.agents.includes(
      "marketStatsAgent"
    )
  );

  assert.ok(
    result.response.length > 0
  );

  console.log(
    "✓ Market orchestration passed"
  );
}

async function testOrchestratorRag() {
  const userId =
    "week9-test-user-rag";

  resetSession(
    userId
  );

  const result =
    await orchestrate(
      "What does DOM mean?",
      userId
    );

  assert.equal(
    result.intent,
    "knowledge"
  );

  assert.ok(
    result.agents.includes(
      "ragAgent"
    )
  );

  assert.ok(
    result.response.length > 0
  );

  console.log(
    "✓ RAG orchestration passed"
  );
}

async function testRecommendationIntent() {
  const userId =
    "week9-test-recommend";

  resetSession(userId);

  // --------------------------------------------------
  // 1. First perform a property search.
  //
  // This gives Week 7 a real listing in
  // session.lastResults to use as its target.
  // --------------------------------------------------

  await orchestrate(
    "Find 3 bedroom homes in Irvine under $1.5M",
    userId
  );

  // --------------------------------------------------
  // 2. Complete any Week 4 follow-up questions.
  // --------------------------------------------------

  let session =
    getSession(userId);

  while (
    session.awaiting !== null
  ) {
    await orchestrate(
      "any",
      userId
    );

    session =
      getSession(userId);
  }

  // --------------------------------------------------
  // 3. Verify the property search produced listings.
  // --------------------------------------------------

  session =
    getSession(userId);

  assert.ok(
    session.lastResults.length > 0,
    "Property search should populate lastResults before recommendation"
  );

  const targetListingId =
    session.lastResults[0]
      .L_ListingID;

  assert.ok(
    targetListingId,
    "A target listing ID should exist"
  );

  // --------------------------------------------------
  // 4. Ask for recommendations.
  //
  // Because lastResults now exists, Week 7 can use
  // the first result as fallbackListingId.
  // --------------------------------------------------

  const result =
    await orchestrate(
      "Show me similar homes to this",
      userId
    );

  // --------------------------------------------------
  // 5. Verify Week 9 routing.
  // --------------------------------------------------

  assert.equal(
    result.intent,
    "recommend"
  );

  assert.ok(
    result.agents.includes(
      "recommendationAgent"
    )
  );

  // --------------------------------------------------
  // 6. Verify the recommendation agent actually
  //    returned recommendations.
  // --------------------------------------------------

  const recommendationResult =
    result.results.find(
      (item) =>
        item.agent ===
        "recommendationAgent"
    );

  assert.ok(
    recommendationResult,
    "recommendationAgent result should exist"
  );

  assert.ok(
    Array.isArray(
      recommendationResult.recommendations
    ),
    "Recommendation result should contain a recommendations array"
  );

  assert.ok(
    (
      recommendationResult
        .recommendations?.length ??
      0
    ) > 0,
    "Recommendation agent should return at least one recommendation"
  );

  assert.ok(
    result.response.length > 0
  );

  console.log(
    "✓ Recommendation orchestration passed"
  );
}

async function testEmailDraft() {
  const userId =
    "week9-test-email";

  resetSession(
    userId
  );

  const result =
    await orchestrate(
      "Draft an email with the Pasadena market report",
      userId
    );

  assert.equal(
    result.intent,
    "email"
  );

  assert.ok(
    result.agents.includes(
      "emailDraftAgent"
    )
  );

  const metadata =
    result.results[0]
      ?.metadata as
      | Record<string, unknown>
      | undefined;

  assert.equal(
    metadata?.status,
    "pending_approval"
  );

  console.log(
    "✓ Email draft orchestration passed"
  );
}

/**
 * Verify the NEW Week 9 behavior:
 *
 * 1. Mixed query is detected.
 * 2. Property agent runs first.
 * 3. Week 4 asks for missing information.
 * 4. Market intent becomes pending.
 */
async function testMixedIntentStartsConversation() {
  const userId =
    "week9-test-mixed-start";

  resetSession(
    userId
  );

  const result =
    await orchestrate(
      "Find affordable homes in Pasadena and tell me whether prices are rising",
      userId
    );

  assert.equal(
    result.intent,
    "mixed"
  );

  // Property agent must run first.
  assert.ok(
    result.agents.includes(
      "propertySearchAgent"
    )
  );

  // Market agent should NOT run yet because
  // Week 4 needs additional information.
  assert.equal(
    result.agents.includes(
      "marketStatsAgent"
    ),
    false
  );

  assert.ok(
    result.response.includes(
      "What is your maximum budget?"
    )
  );

  const session =
    getSession(
      userId
    );

  assert.ok(
    session.pendingIntents?.includes(
      "market"
    )
  );

  assert.equal(
    session.pendingQuery,
    "Find affordable homes in Pasadena and tell me whether prices are rising"
  );

  console.log(
    "✓ Mixed-intent pending conversation passed"
  );
}

/**
 * Verify that the Week 4 follow-up can continue
 * while the market intent remains pending.
 */
async function testMixedIntentFollowUp() {
  const userId =
    "week9-test-mixed-followup";

  resetSession(
    userId
  );

  // Start the mixed request.
  const first =
    await orchestrate(
      "Find affordable homes in Pasadena and tell me whether prices are rising",
      userId
    );

  assert.equal(
    first.intent,
    "mixed"
  );

  const firstSession =
    getSession(
      userId
    );

  assert.equal(
    firstSession.awaiting,
    "budget"
  );

  assert.ok(
    firstSession.pendingIntents?.includes(
      "market"
    )
  );

  // Answer the budget question.
  const second =
    await orchestrate(
      "any",
      userId
    );

  assert.equal(
    second.agents.includes(
      "propertySearchAgent"
    ),
    true
  );

  const secondSession =
    getSession(
      userId
    );

  // Week 4 should continue asking questions.
  assert.ok(
    secondSession.awaiting !== null
  );

  // Market intent must remain pending.
  assert.ok(
    secondSession.pendingIntents?.includes(
      "market"
    )
  );

  console.log(
    "✓ Mixed-intent conversational follow-up passed"
  );
}

/**
 * This test verifies the final important behavior:
 *
 * Once Week 4 finishes collecting the search filters,
 * the pending market agent runs using the stored market
 * context rather than the user's latest reply ("any").
 */
async function testMixedIntentCompletesAndRunsMarket() {
  const userId =
    "week9-test-mixed-complete";

  resetSession(
    userId
  );

  // --------------------------------------------------
  // 1. Start the original mixed request.
  // --------------------------------------------------

  const first =
    await orchestrate(
      "Quiet single family home in a tree-lined neighborhood and tell me whether prices are rising",
      userId
    );

  assert.equal(
    first.intent,
    "mixed"
  );

  const firstSession =
    getSession(
      userId
    );

  assert.equal(
    firstSession.awaiting,
    "city"
  );

  assert.ok(
    firstSession.pendingIntents?.includes(
      "market"
    )
  );

  // --------------------------------------------------
  // 2. Answer the city question.
  // --------------------------------------------------

  const cityResult =
    await orchestrate(
      "Pasadena",
      userId
    );

  assert.ok(
    cityResult.response.length > 0
  );

  const citySession =
    getSession(
      userId
    );

  assert.equal(
    citySession.city,
    "Pasadena"
  );

  assert.ok(
    citySession.pendingIntents?.includes(
      "market"
    )
  );

  // --------------------------------------------------
  // 3. Answer the budget question.
  // --------------------------------------------------

  const budgetResult =
    await orchestrate(
      "any",
      userId
    );

  assert.ok(
    budgetResult.response.length > 0
  );

  // --------------------------------------------------
  // 4. Answer the bedrooms question.
  // --------------------------------------------------

  const bedsResult =
    await orchestrate(
      "any",
      userId
    );

  assert.ok(
    bedsResult.response.length > 0
  );

  // --------------------------------------------------
  // 5. Answer the bathrooms question.
  // --------------------------------------------------
  //
  // "single family" was already supplied in the
  // original query, so Week 4 does not need to ask
  // for the property type.
  // --------------------------------------------------

  const finalResult =
    await orchestrate(
      "any",
      userId
    );

  // --------------------------------------------------
  // 6. Week 4 should now be complete and the
  //    pending market agent should have executed.
  // --------------------------------------------------

  assert.equal(
    finalResult.intent,
    "mixed"
  );

  assert.ok(
    finalResult.agents.includes(
      "propertySearchAgent"
    )
  );

  assert.ok(
    finalResult.agents.includes(
      "marketStatsAgent"
    )
  );

  assert.equal(
    finalResult.agents.length,
    2
  );

  // --------------------------------------------------
  // 7. Verify both agent sections are present.
  // --------------------------------------------------

  assert.ok(
    finalResult.response.includes(
      "propertySearchAgent"
    )
  );

  assert.ok(
    finalResult.response.includes(
      "marketStatsAgent"
    )
  );

  // --------------------------------------------------
  // 8. Verify the market agent actually received
  //    the property context collected during Week 4.
  // --------------------------------------------------

  const marketResult =
    finalResult.results.find(
      (item) =>
        item.agent ===
        "marketStatsAgent"
    );

  assert.ok(
    marketResult,
    "marketStatsAgent result should exist"
  );

  const marketMetadata =
    marketResult.metadata as
      | Record<string, unknown>
      | undefined;

  const marketFilters =
    marketMetadata?.filters as
      | Record<string, unknown>
      | undefined;

  assert.equal(
    marketFilters?.city,
    "Pasadena"
  );

  assert.equal(
    marketFilters?.propertyType,
    "SingleFamilyResidence"
  );

  assert.equal(
    marketFilters?.months,
    24
  );

  // --------------------------------------------------
  // 9. Verify Week 9 pending state was cleared.
  // --------------------------------------------------

  const finalSession =
    getSession(
      userId
    );

  assert.equal(
    finalSession.pendingIntents?.length ?? 0,
    0
  );

  assert.equal(
    finalSession.pendingQuery ?? null,
    null
  );

  // --------------------------------------------------
  // 10. Verify the temporary Week 5 market fields
  //     were cleared after the pending agent ran.
  // --------------------------------------------------

  assert.equal(
    finalSession.marketCity ?? null,
    null
  );

  assert.equal(
    finalSession.marketZip ?? null,
    null
  );

  assert.equal(
    finalSession.marketPropertyType ?? null,
    null
  );

  assert.equal(
    finalSession.marketMonths ?? null,
    null
  );

  console.log(
    "✓ Mixed-intent completion and pending market execution passed"
  );
}

async function run() {
  console.log(
    "\n========== WEEK 9 ORCHESTRATION TESTS ==========\n"
  );

  await testIntentClassifier();

  await testOrchestratorSearch();

  await testOrchestratorMarket();

  await testOrchestratorRag();

  await testRecommendationIntent();

  await testEmailDraft();

  await testMixedIntentStartsConversation();

  await testMixedIntentFollowUp();

  await testMixedIntentCompletesAndRunsMarket();

  console.log(
    "\n✓ ALL WEEK 9 TESTS PASSED\n"
  );
}

run().catch(
  (error) => {
    console.error(
      "\n✗ WEEK 9 TEST FAILURE\n",
      error
    );

    process.exit(
      1
    );
  }
).finally(async () => {
    await closeDb();
    console.log("Database connection closed.");
  });