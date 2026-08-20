import assert from "node:assert/strict";
import { closeDb } from "../../config/db";
import {onWhatsAppMessage,} from "../services/whatsapp";

async function test(
  name: string,
  message: string,
  userId: string
) {
  console.log(`\n=== ${name} ===`);

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  // Silence logs produced by services during the test.
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};

  try {
    const response =
      await onWhatsAppMessage(
        message,
        userId
      );

    if (
      !response ||
      response.trim().length === 0
    ) {
      throw new Error(
        `${name} returned an empty response`
      );
    }
  } finally {
    // Restore console output.
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }

  console.log("✓ Passed");
}

async function run() {
  await test(
    "Property Search",
    "3 bedroom 2 bathroom condo in Irvine under $1.5M",
    "week10-property",
    (response) => {
      assert.match(
        response,
        /top matches|matching listings|page \d+/i,
        "Property search did not return property results"
      );
    }
  );

   await test(
    "ZIP Market Analytics",
    "Give me market statistics for ZIP 92618",
    "week10-market-zip",
    (response) => {
      assert.match(
        response,
        /market report|sold comps|median close price/i,
        "Market analytics did not return a market report"
      );
    }
  );

 await test(
    "RAG Field Definition",
    "What does AssociationFee mean?",
    "week10-rag-field",
    (response) => {
      assert.match(
        response,
        /AssociationFee/i,
        "RAG response did not contain AssociationFee"
      );

      assert.match(
        response,
        /RAG Answer|Confidence|Sources/i,
        "RAG response was not formatted correctly"
      );
    }
  );

  await test(
    "RAG Schema Question",
    "What columns are in california_sold?",
    "week10-rag-schema",
    (response) => {
      assert.match(
        response,
        /california_sold/i,
        "Schema response did not reference california_sold"
      );

      assert.match(
        response,
        /ClosePrice|ListingKey|City|PropertyType/i,
        "Schema response did not contain expected columns"
      );
    }
  );

  const recommendationUser =
    "week10-recommendation";

  await test(
    "Recommendation Search Setup",
    "3 bedroom 2 bathroom condo in Irvine under $1.5M",
    recommendationUser,
    (response) => {
      assert.match(
        response,
        /top matches|matching listings|page \d+/i,
        "Recommendation setup did not return listings"
      );
    }
  );

  await test(
    "Recommendation",
    "Show me similar homes to this",
    recommendationUser,
    (response) => {
      assert.doesNotMatch(
        response,
        /could not build recommendations/i,
        "Recommendation engine returned a failure response"
      );

      assert.match(
        response,
        /top matches for|target price|comp estimate|score/i,
        "Recommendation response did not contain recommendation results"
      );
    }
  );

  await test(
    "Mixed Intent",
    "Find 3 bedroom 2 bathroom condos in Pasadena under $2M and tell me whether prices are rising",
    "week10-mixed",
    (response) => {
      assert.match(
        response,
        /top matches|propertySearchAgent|marketStatsAgent|market report|combined response/i,
        "Mixed-intent request did not return expected output"
      );
    }
  );

   await test(
    "Semantic Property Search",
    "Find me a modern spacious 3 bedroom 2 bathroom condo with natural light in Irvine under $2M",
    "week10-semantic",
    (response) => {
      assert.match(
        response,
        /top matches|matching listings|semantic preference|page \d+/i,
        "Semantic property search did not return results"
      );
    }
  );

  await test(
    "Session Reset",
    "reset",
    "week10-reset",
    (response) => {
      assert.match(
        response,
        /conversation cleared/i,
        "Reset command did not clear the conversation"
      );
    }
  );

  console.log(
    "\n✓ Week 10 WhatsApp layer tests passed"
  );
}


run().catch((error) => {
  console.error(
    "\n✗ Week 10 tests failed:"
  );
  console.error(error);
  process.exit(1);
}).finally(async () => {
    await closeDb();
    console.log("Database connection closed.");
  });