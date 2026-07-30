import assert from "node:assert/strict";
import { closeDb } from "../../config/db";
import { getEmbedding, getEmbeddings, cosineSimilarity } from "../services/embeddings";

async function testSingleEmbedding(): Promise<void> {
  const emb = await getEmbedding("charming craftsman with mountain views");

  assert.ok(Array.isArray(emb), "Embedding should be an array");
  assert.ok(emb.length > 0, "Embedding should not be empty");
  assert.ok(emb.every((n) => typeof n === "number"), "Embedding should contain numbers");

  console.log("✓ Single embedding generation passed");
}

async function testBatchEmbedding(): Promise<void> {
  const texts = [
    "charming craftsman with mountain views",
    "quiet family home in Newport Beach",
    "modern open concept condo",
  ];

  const embs = await getEmbeddings(texts);

  assert.equal(embs.length, texts.length, "Batch embeddings should match input size");
  assert.ok(embs.every((e) => Array.isArray(e) && e.length > 0), "Each embedding should be non-empty");
  assert.ok(
    embs.every((e) => e.every((n) => typeof n === "number")),
    "Each embedding should contain numbers"
  );

  console.log("✓ Batch embedding generation passed");
}

async function testCosineSimilarity(): Promise<void> {
  const a = await getEmbedding("quiet family home");
  const b = await getEmbedding("quiet family home");
  const c = await getEmbedding("industrial warehouse near port");

  const sameScore = cosineSimilarity(a, b);
  const differentScore = cosineSimilarity(a, c);

  assert.ok(sameScore > 0.99, `Expected very high similarity for identical text, got ${sameScore}`);
  assert.ok(
    differentScore <= sameScore,
    "Different text should not score higher than identical text"
  );

  console.log("✓ Cosine similarity sanity check passed");
}

async function run(): Promise<void> {
  const tests: Array<{ name: string; fn: () => Promise<void> }> = [
    { name: "Single embedding", fn: testSingleEmbedding },
    { name: "Batch embedding", fn: testBatchEmbedding },
    { name: "Cosine similarity", fn: testCosineSimilarity },
  ];

  let failed = 0;

  for (const test of tests) {
    try {
      await test.fn();
    } catch (err) {
      failed += 1;
      console.error(`✗ ${test.name} failed:`, err);
    }
  }

  if (failed === 0) {
    console.log(`\nAll embeddings tests passed (${tests.length}/${tests.length}).`);
  } else {
    console.error(`\nEmbeddings tests failed: ${failed}/${tests.length}`);
    process.exitCode = 1;
  }
}

run()
  .catch((err) => {
    console.error("Week 6 embeddings tests failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
    console.log("Database connection closed.");
  });