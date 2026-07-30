import assert from "node:assert/strict";
import { closeDb } from "../../config/db";
import { getEmbedding, cosineSimilarity } from "../services/embeddings";
import { semanticPropertySearch, rerankListings } from "../services/semanticSearch";
import type { ListingRow } from "../types/propertyFilters";

function makeListing(overrides: Partial<ListingRow> = {}): ListingRow {
  return {
    L_ListingID: "test-1",
    L_DisplayId: "TEST-1",
    L_Address: "123 Test St",
    L_City: "Los Angeles",
    L_Zip: "90001",
    L_Remarks: "Charming craftsman with mountain views and character.",
    price: 1250000,
    beds: 3,
    baths: 2,
    sqft: 1800,
    type: "SingleFamilyResidence",
    status: "Active",
    lat: null,
    lng: null,
    YearBuilt: 1975,
    AssociationFee: null,
    DaysOnMarket: 12,
    PoolPrivateYN: null,
    ViewYN: null,
    FireplaceYN: null,
    PhotoCount: 12,
    LA1_UserFirstName: "Test",
    LA1_UserLastName: "Agent",
    LO1_OrganizationName: "Test Realty",
    ...overrides,
  };
}

function assertSortedDescending(values: number[]): void {
  for (let i = 1; i < values.length; i++) {
    assert.ok(
      values[i - 1] >= values[i] - 1e-9,
      `Expected descending order, but ${values[i - 1]} < ${values[i]} at index ${i}`
    );
  }
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

async function testSemanticPropertySearch(): Promise<void> {
  const results = await semanticPropertySearch(
    "charming craftsman with mountain views and character",
    5,
    80
  );

  assert.ok(results.length > 0, "Expected at least one semantic match");
  assert.ok(results.length <= 5, "Expected topK results only");

  const scores = results.map((r) => r.score);
  assert.ok(scores.every((s) => typeof s === "number"), "Every result should have a score");
  assert.ok(scores.every((s) => s >= -1 && s <= 1), "Scores should be valid cosine similarities");
  assertSortedDescending(scores);

  for (const result of results) {
    assert.ok(result.address.length > 0, "Result should have an address");
    assert.ok(result.city.length > 0, "Result should have a city");
    assert.ok(typeof result.remarks === "string" || result.remarks === null);
  }

  console.log("✓ Semantic search returned ranked matches");
}

async function testHybridPropertySearch(): Promise<void> {
  const results = await semanticPropertySearch(
    "Quiet family home in Newport Beach under $1.8M",
    5,
    80
  );

  assert.ok(results.length > 0, "Expected hybrid search to return results");
  assert.ok(results.length <= 5, "Expected topK results only");

  const scores = results.map((r) => r.score);
  assert.ok(scores.every((s) => typeof s === "number"), "Hybrid results should have scores");
  assertSortedDescending(scores);

  assert.ok(
    results.every((r) => r.city.toLowerCase() === "newport beach"),
    "Structured city filter should stay applied"
  );

  console.log("✓ Hybrid search preserved filters and semantic ranking");
}

async function testRerankListings(): Promise<void> {
  const query = "charming craftsman with mountain views and character";

  const listings: ListingRow[] = [
    makeListing({
      L_ListingID: "a",
      L_Address: "1 Craftsman Way",
      L_City: "Pasadena",
      L_Remarks: "Charming craftsman with mountain views and original character.",
      type: "SingleFamilyResidence",
      price: 1450000,
    }),
    makeListing({
      L_ListingID: "b",
      L_Address: "2 Modern Ave",
      L_City: "Irvine",
      L_Remarks: "Modern condo with open floor plan and shopping nearby.",
      type: "Condominium",
      price: 995000,
    }),
    makeListing({
      L_ListingID: "c",
      L_Address: "3 Quiet Ln",
      L_City: "Beverly Hills",
      L_Remarks: "Quiet estate with privacy and sweeping mountain views.",
      type: "SingleFamilyResidence",
      price: 2795000,
    }),
  ];

  const ranked = await rerankListings(listings, query);

  assert.equal(ranked.length, listings.length, "Rerank should keep all listings");
  assert.ok(typeof ranked[0].score === "number", "Ranked listings should include scores");

  const scores = ranked.map((r) => r.score ?? 0);
  assertSortedDescending(scores);

  assert.ok(
    (ranked[0].L_Remarks ?? "").toLowerCase().includes("craftsman") ||
      (ranked[0].L_Remarks ?? "").toLowerCase().includes("mountain views"),
    "Best semantic match should rank first"
  );

  console.log("✓ Rerank helper attached scores and sorted results");
}

async function run(): Promise<void> {
  const tests: Array<{ name: string; fn: () => Promise<void> | void }> = [
    { name: "Embedding generation", fn: testEmbeddingGeneration },
    { name: "Cosine similarity sanity check", fn: testCosineSimilarity },
    { name: "Semantic property search", fn: testSemanticPropertySearch },
    { name: "Hybrid property search", fn: testHybridPropertySearch },
    { name: "Rerank listings", fn: testRerankListings },
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
    console.log(`\nAll Week 6 tests passed (${tests.length}/${tests.length}).`);
  } else {
    console.error(`\nWeek 6 tests failed: ${failed}/${tests.length}`);
    process.exitCode = 1;
  }
}

run()
  .catch((err) => {
    console.error("Week 6 semantic search tests failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
    console.log("Database connection closed.");
  });