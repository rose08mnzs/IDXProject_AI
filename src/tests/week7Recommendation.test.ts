import assert from "node:assert/strict";
import { closeDb } from "../../config/db";
import { getEmbedding, cosineSimilarity } from "../services/embeddings";
import { recommendSimilarListings } from "../services/recommendation";
import type { ListingRow } from "../types/propertyFilters";

function assertSortedDescending(values: number[]): void {
  for (let i = 1; i < values.length; i++) {
    assert.ok(
      values[i - 1] >= values[i] - 1e-9,
      `Expected descending order, but ${values[i - 1]} < ${values[i]} at index ${i}`
    );
  }
}

async function getReferenceTarget(zip = "92620"): Promise<ListingRow> {
  const result = await recommendSimilarListings({
    zip,
    topK: 1,
  });

  assert.ok(result.target, `Expected a target listing for ZIP ${zip}`);
  return result.target;
}

async function testEmbeddingGeneration(): Promise<void> {
  const emb = await getEmbedding("charming craftsman with mountain views");
  assert.ok(Array.isArray(emb), "Embedding should be an array");
  assert.ok(emb.length > 0, "Embedding should not be empty");
}

function testCosineSimilarity(): void {
  const same = cosineSimilarity([1, 0, 0], [1, 0, 0]);
  const orthogonal = cosineSimilarity([1, 0, 0], [0, 1, 0]);

  assert.ok(Math.abs(same - 1) < 1e-9, "Identical vectors should have similarity 1");
  assert.ok(Math.abs(orthogonal) < 1e-9, "Orthogonal vectors should have similarity 0");
}

async function testRecommendationByZipCode(): Promise<void> {
  const result = await recommendSimilarListings({
    zip: "92620",
    topK: 5,
  });

  assert.ok(result.target, "Expected a target listing when searching by ZIP");
  assert.equal(result.target.L_Zip, "92620", "Target listing should match the requested ZIP");
  assert.ok(result.recommendations.length > 0, "Expected recommendation results");
  assert.ok(result.recommendations.length <= 5, "Expected topK results only");

  const scores = result.recommendations.map((r) => r.totalScore);
  assertSortedDescending(scores);

  console.log("✓ Recommendation by ZIP code returned ranked matches");
}

async function testRecommendationByAddress(): Promise<void> {
  const target = await getReferenceTarget("92620");

  const result = await recommendSimilarListings({
    address: target.L_Address,
    city: target.L_City,
    topK: 5,
  });

  assert.ok(result.target, "Expected a target listing when searching by address");
  assert.equal(
    result.target.L_ListingID,
    target.L_ListingID,
    "Target listing should match the requested active listing"
  );
  assert.ok(result.recommendations.length > 0, "Expected recommendation results");
  assertSortedDescending(result.recommendations.map((r) => r.totalScore));

  console.log("✓ Recommendation by address returned ranked matches");
}

async function testRecommendationBySecondAddress(): Promise<void> {
  const target = await getReferenceTarget("92620");

  const result = await recommendSimilarListings({
    address: target.L_Address,
    city: target.L_City,
    topK: 5,
  });

  assert.ok(result.target, "Expected a target listing when searching by address");
  assert.equal(
    result.target.L_ListingID,
    target.L_ListingID,
    "Target listing should match the requested active listing"
  );
  assert.ok(result.recommendations.length > 0, "Expected recommendation results");
  assertSortedDescending(result.recommendations.map((r) => r.totalScore));

  console.log("✓ Second address recommendation returned ranked matches");
}

async function testRecommendationByFallbackListing(): Promise<void> {
  const target = await getReferenceTarget("92620");

  const result = await recommendSimilarListings({
    fallbackListingId: target.L_ListingID,
    topK: 5,
  });

  assert.ok(result.target, "Expected a target listing from fallback ID");
  assert.equal(result.target.L_ListingID, target.L_ListingID);
  assert.ok(result.recommendations.length > 0, "Expected recommendation results");
  assertSortedDescending(result.recommendations.map((r) => r.totalScore));

  console.log("✓ Recommendation by fallback listing returned ranked matches");
}

async function testRecommendationCompValidation(): Promise<void> {
  const result = await recommendSimilarListings({
    zip: "92620",
    topK: 3,
  });

  assert.ok(result.targetCompCheck, "Expected comp validation for the target");
  assert.ok(
    typeof result.targetCompCheck.comp_count === "number",
    "Comp count should be numeric"
  );
  assert.ok(
    typeof result.targetCompCheck.comp_price === "number",
    "Comp price should be numeric"
  );

  console.log("✓ Comp validation returned target market estimate");
}

async function testRecommendationScoreShape(): Promise<void> {
  const result = await recommendSimilarListings({
    zip: "92620",
    topK: 3,
  });

  for (const item of result.recommendations) {
    assert.ok(typeof item.totalScore === "number", "Total score should be numeric");
    assert.ok(typeof item.structuredScore === "number", "Structured score should be numeric");
    assert.ok(typeof item.semanticScore === "number", "Semantic score should be numeric");
    assert.ok(item.listing.L_Address.length > 0, "Recommendation should have an address");
    assert.ok(item.compCheck.comp_count >= 0, "Comp count should be non-negative");
  }

  console.log("✓ Recommendation results include scoring and comp data");
}

async function run(): Promise<void> {
  const tests: Array<{ name: string; fn: () => Promise<void> | void }> = [
    { name: "Recommendation by ZIP code", fn: testRecommendationByZipCode },
    { name: "Recommendation by address", fn: testRecommendationByAddress },
    { name: "Second address recommendation", fn: testRecommendationBySecondAddress },
    { name: "Recommendation by fallback listing", fn: testRecommendationByFallbackListing },
    { name: "Comp validation", fn: testRecommendationCompValidation },
    { name: "Recommendation score shape", fn: testRecommendationScoreShape },
  ];

  const passed: string[] = [];
  let failed = 0;

  for (const test of tests) {
    try {
      await test.fn();
      passed.push(test.name);
      console.log(`✓ ${test.name} passed`);
    } catch (err) {
      failed += 1;
      console.error(`✗ ${test.name} failed:`, err);
    }
  }

  console.log("\nTest summary:");
  console.log(`Passed (${passed.length}/${tests.length}):`);
  for (const name of passed) {
    console.log(`- ${name}`);
  }

  if (failed === 0) {
    console.log(`\nAll Week 7 tests passed (${tests.length}/${tests.length}).`);
  } else {
    console.error(`\nWeek 7 tests failed: ${failed}/${tests.length}`);
    process.exitCode = 1;
  }
}

run()
  .catch((err) => {
    console.error("Week 7 recommendation tests failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
    console.log("Database connection closed.");
  });