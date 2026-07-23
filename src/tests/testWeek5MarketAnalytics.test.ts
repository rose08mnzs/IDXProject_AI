import assert from "node:assert/strict";
import { week5Skill } from "../skills/week5Skill";
import { closeDb } from "../../config/db";
async function run() {

  // Test 1 - Market statistics
  const marketStats = await week5Skill(
    "test-user",
    "Market stats in Irvine"
  );

  assert.ok(marketStats.response.includes("Market Report"));
  console.log("✓ Market statistics test passed");

  // Test 2 - Price per sqft
  const ppsf = await week5Skill(
    "test-user2",
    "What is the average price per sqft in Pasadena?"
  );

  assert.ok(ppsf.response.includes("Average price per sqft"));
  console.log("✓ Price per sqft test passed");

  // Test 3 - ZIP code trends
  const zip = await week5Skill(
    "test-user3",
    "Show me trends for 92612 over the last 6 months"
  );

  assert.ok(zip.response.includes("Trend"));
  console.log("✓ ZIP code trend test passed");

  // Test 4 - Property type analytics
  const condo = await week5Skill(
    "test-user4",
    "Market analytics for condominiums"
  );

  assert.ok(condo.response.includes("Condominium"));
  console.log("✓ Property type analytics test passed");

  console.log("\nAll Week 5 Market Analytics tests passed.");
}

run().catch((err) => {
  console.error("Week 5 Market Analytics tests failed:", err);
  process.exitCode = 1;
}).finally(async () => {
    await closeDb();
    console.log("Database connection closed.");
});