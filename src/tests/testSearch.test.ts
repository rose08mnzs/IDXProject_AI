import assert from "node:assert/strict";
import { handlePropertyQuery } from "../services/listings";
import { closeDb } from "../../config/db";

async function main() {
  try {
    const result = await handlePropertyQuery("3 bedroom condo in Irvine under 1.5m");

    assert.ok(result.listings.length > 0, "Expected at least one listing");
    assert.ok(result.totalHint >= result.listings.length, "Total hint should cover returned rows");
    assert.equal(result.page, 1, "Expected page 1");
    assert.equal(result.limit, 10, "Expected default limit 10");

    console.log("PASS - Search query returned listings");
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await closeDb();
  }
}


main().catch((err) => {
  console.error("Search test failed:", err);
  process.exit(1);
});