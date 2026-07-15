import assert from "node:assert/strict";
import { query, closeDb } from "../../config/db";

async function main() {
  try {
    const rows = await query<{ total: number }>(
      "SELECT COUNT(*) AS total FROM rets_property",
    );

    const total = rows[0]?.total ?? 0;
    assert.ok(total > 0, "Expected rets_property to contain rows");

    console.log("PASS - DB connection works");
    console.log("rets_property count:", total);
  } finally {
    await closeDb();
  }
}


main().catch((err) => {
  console.error("DB test failed:", err);
  process.exit(1);
});