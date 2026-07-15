import assert from "node:assert/strict";
import { parsePropertyQuery } from "../parser/propertyParser";
import { handleWeek3Search } from "../skills/week3Skill";
import { closeDb } from "../../config/db";

async function main() {
  try {
    const filters = await parsePropertyQuery("3 bedroom condo in Irvine under 1.5m");

    const result = await handleWeek3Search({
      filters,
      page: 1,
      limit: 5,
    });

    assert.ok(result.listings.length > 0, "Expected at least one listing");
    assert.ok(result.response.trim().length > 0, "Expected a formatted response");

    console.log("PASS - Week 3 skill returned formatted results");
    console.log(result.response);
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error("Week 3 skill test failed:", error);
  process.exit(1);
});