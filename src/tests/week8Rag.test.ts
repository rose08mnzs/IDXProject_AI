import assert from "node:assert/strict";

import {
  answerWeek8Question,
  formatWeek8Response,
  getWeek8Index,
} from "../services/rag";

function assertSource(
  result: Awaited<
    ReturnType<typeof answerWeek8Question>
  >,
  expectedSource: string
): void {
  assert.ok(
    result.sources.length > 0,
    "Expected at least one source"
  );

  const hasExpectedSource =
    result.sources.some(
      (source) =>
        source.source === expectedSource
    );

  assert.ok(
    hasExpectedSource,
    `Expected source ${expectedSource}, got ${result.sources
      .map((source) => source.source)
      .join(", ")}`
  );
}

function assertAnswerContains(
  result: Awaited<
    ReturnType<typeof answerWeek8Question>
  >,
  expected: string
): void {
  assert.ok(
    result.answer
      .toLowerCase()
      .includes(expected.toLowerCase()),
    `Expected answer to contain "${expected}", got:\n${result.answer}`
  );
}

// ======================================================
// INDEX TEST
// ======================================================

async function testWeek8Index(): Promise<void> {
  const index =
    await getWeek8Index();

  assert.ok(
    index.length > 0,
    "Week 8 index should contain chunks"
  );

  const sources = new Set(
    index.map(
      (chunk) => chunk.source
    )
  );

  assert.ok(
    sources.has(
      "Real_Estate_Primer.txt"
    ),
    "Real Estate Primer should be indexed"
  );

  assert.ok(
    sources.has(
      "Trestle_Property_Metadata.txt"
    ),
    "Trestle metadata should be indexed"
  );

  assert.ok(
    sources.has(
      "IDX_Handbook_Schema.txt"
    ),
    "IDX handbook schema should be indexed"
  );

  for (const chunk of index) {
    assert.ok(
      Array.isArray(
        chunk.embedding
      ),
      `Chunk ${chunk.chunkIndex} should have an embedding`
    );

    assert.ok(
      chunk.embedding.length > 0,
      `Chunk ${chunk.chunkIndex} embedding should not be empty`
    );
  }

  console.log(
    `✓ Week 8 index loaded ${index.length} chunks`
  );
}

// ======================================================
// DOM
// ======================================================

async function testDomDefinition(): Promise<void> {
  const result =
    await answerWeek8Question(
      "What does DOM mean?"
    );

  assertSource(
    result,
    "Real_Estate_Primer.txt"
  );

  assertAnswerContains(
    result,
    "Days on Market"
  );

  assertAnswerContains(
    result,
    "listed"
  );

  assert.ok(
    result.confidence ===
      "high" ||
      result.confidence ===
        "medium",
    "DOM answer should have medium or high confidence"
  );

  console.log(
    "✓ DOM definition retrieved from Real Estate Primer"
  );
}

// ======================================================
// LIST-TO-CLOSE
// ======================================================

async function testListToCloseRatio(): Promise<void> {
  const result =
    await answerWeek8Question(
      "What is a list-to-close ratio?"
    );

  assertSource(
    result,
    "Real_Estate_Primer.txt"
  );

  assertAnswerContains(
    result,
    "ClosePrice"
  );

  assertAnswerContains(
    result,
    "ListPrice"
  );

  assertAnswerContains(
    result,
    "sale-to-list"
  );

  assert.ok(
    result.confidence ===
      "high" ||
      result.confidence ===
        "medium",
    "List-to-close answer should have medium or high confidence"
  );

  console.log(
    "✓ List-to-close ratio retrieved from Real Estate Primer"
  );
}

// ======================================================
// CALIFORNIA_SOLD SCHEMA
// ======================================================

async function testCaliforniaSoldSchema(): Promise<void> {
  const result =
    await answerWeek8Question(
      "What columns are in california_sold?"
    );

  assertSource(
    result,
    "IDX_Handbook_Schema.txt"
  );

  assertAnswerContains(
    result,
    "california_sold"
  );

  assertAnswerContains(
    result,
    "ListingKey"
  );

  assertAnswerContains(
    result,
    "ClosePrice"
  );

  assertAnswerContains(
    result,
    "CloseDate"
  );

  assertAnswerContains(
    result,
    "ListPrice"
  );

  assert.ok(
    result.confidence ===
      "high" ||
      result.confidence ===
        "medium",
    "california_sold schema should have medium or high confidence"
  );

  console.log(
    "✓ california_sold schema retrieved from handbook"
  );
}

// ======================================================
// ASSOCIATION FEE
// ======================================================

async function testAssociationFee(): Promise<void> {
  const result =
    await answerWeek8Question(
      "What does AssociationFee mean?"
    );

  assertSource(
    result,
    "Trestle_Property_Metadata.txt"
  );

  assertAnswerContains(
    result,
    "AssociationFee"
  );

  assert.ok(
    result.answer.length > 20,
    "AssociationFee answer should contain a useful definition"
  );

  console.log(
    "✓ AssociationFee definition retrieved from Trestle metadata"
  );
}

// ======================================================
// LEGACY IDX FIELD
// ======================================================

async function testLegacyIdxField(): Promise<void> {
  const result =
    await answerWeek8Question(
      "What does L_SystemPrice mean?"
    );

  assertSource(
    result,
    "IDX_Handbook_Schema.txt"
  );

  assertAnswerContains(
    result,
    "L_SystemPrice"
  );

  assert.ok(
    result.answer.length > 20,
    "L_SystemPrice answer should contain the field definition"
  );

  console.log(
    "✓ L_SystemPrice definition retrieved from handbook schema"
  );
}

// ======================================================
// STANDARDSTATUS
// ======================================================

async function testStandardStatus(): Promise<void> {
  const result =
    await answerWeek8Question(
      "What is StandardStatus?"
    );

  const validSources =
    result.sources.some(
      (source) =>
        source.source ===
          "Trestle_Property_Metadata.txt" ||
        source.source ===
          "Real_Estate_Primer.txt"
    );

  assert.ok(
    validSources,
    `Expected StandardStatus from Trestle or Primer, got ${result.sources
      .map((source) => source.source)
      .join(", ")}`
  );

  assertAnswerContains(
    result,
    "StandardStatus"
  );

  console.log(
    "✓ StandardStatus definition retrieved"
  );
}

// ======================================================
// GENERIC IDENTIFIER ROUTING
// ======================================================

async function testGenericIdentifierQuestion(): Promise<void> {
  const result =
    await answerWeek8Question(
      "Explain LM_Dec_3"
    );

  assert.ok(
    result.sources.length > 0,
    "Expected source for LM_Dec_3"
  );

  assertAnswerContains(
    result,
    "LM_Dec_3"
  );

  assert.ok(
    result.answer.length > 20,
    "LM_Dec_3 answer should contain useful source text"
  );

  console.log(
    "✓ Generic underscore field retrieval works"
  );
}

// ======================================================
// RESPONSE FORMAT
// ======================================================

async function testResponseFormatting(): Promise<void> {
  const result =
    await answerWeek8Question(
      "What does DOM mean?"
    );

  const formatted =
    formatWeek8Response(
      result
    );

  assert.ok(
    formatted.includes(
      "📚 RAG Answer"
    ),
    "Formatted response should contain RAG header"
  );

  assert.ok(
    formatted.includes(
      "Confidence:"
    ),
    "Formatted response should contain confidence"
  );

  assert.ok(
    formatted.includes(
      "Sources:"
    ),
    "Formatted response should contain sources"
  );

  assert.ok(
    formatted.includes(
      "Real_Estate_Primer.txt"
    ),
    "Formatted response should contain source name"
  );

  console.log(
    "✓ Week 8 response formatting passed"
  );
}

// ======================================================
// NO EMPTY ANSWERS
// ======================================================

async function testNoEmptyAnswers(): Promise<void> {
  const questions = [
    "What does DOM mean?",
    "What is a list-to-close ratio?",
    "What columns are in california_sold?",
    "What does AssociationFee mean?",
    "What does L_SystemPrice mean?",
  ];

  for (const question of questions) {
    const result =
      await answerWeek8Question(
        question
      );

    assert.ok(
      result.answer.trim().length >
        0,
      `Expected non-empty answer for: ${question}`
    );

    assert.ok(
      result.sources.length > 0,
      `Expected sources for: ${question}`
    );
  }

  console.log(
    "✓ Week 8 answers are non-empty and sourced"
  );
}

// ======================================================
// RUNNER
// ======================================================

async function run(): Promise<void> {
  const tests: Array<{
    name: string;
    fn: () => Promise<void>;
  }> = [
    {
      name: "Week 8 index",
      fn: testWeek8Index,
    },
    {
      name: "DOM definition",
      fn: testDomDefinition,
    },
    {
      name: "List-to-close ratio",
      fn: testListToCloseRatio,
    },
    {
      name: "california_sold schema",
      fn: testCaliforniaSoldSchema,
    },
    {
      name: "AssociationFee definition",
      fn: testAssociationFee,
    },
    {
      name: "L_SystemPrice definition",
      fn: testLegacyIdxField,
    },
    {
      name: "StandardStatus definition",
      fn: testStandardStatus,
    },
    {
      name: "Generic identifier retrieval",
      fn: testGenericIdentifierQuestion,
    },
    {
      name: "Response formatting",
      fn: testResponseFormatting,
    },
    {
      name: "No empty answers",
      fn: testNoEmptyAnswers,
    },
  ];

  const passed: string[] = [];
  let failed = 0;

  console.log(
    "\n========== WEEK 8 RAG TESTS ==========\n"
  );

  for (const test of tests) {
    try {
      await test.fn();

      passed.push(
        test.name
      );

      console.log(
        `✓ ${test.name} passed`
      );
    } catch (err) {
      failed += 1;

      console.error(
        `✗ ${test.name} failed:`,
        err
      );
    }
  }

  console.log(
    "\n========== TEST SUMMARY ==========\n"
  );

  console.log(
    `Passed: ${passed.length}/${tests.length}`
  );

  if (passed.length > 0) {
    for (const name of passed) {
      console.log(
        `- ${name}`
      );
    }
  }

  if (failed === 0) {
    console.log(
      `\nAll Week 8 tests passed (${tests.length}/${tests.length}).`
    );
  } else {
    console.error(
      `\nWeek 8 tests failed: ${failed}/${tests.length}`
    );

    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(
    "Week 8 RAG tests failed:",
    err
  );

  process.exitCode = 1;
});