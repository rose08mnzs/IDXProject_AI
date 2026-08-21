import assert from "node:assert/strict";
import { closeDb } from "../../config/db";
import {draftEmail,sendApprovedEmail,setTestEmailTransport,} from "../services/email";
import type {EmailDraft,EmailDraftPurpose,} from "../agents/types";
let sendCount = 0;

const sentMessages: Array<{
  from: string;
  to: string;
  subject: string;
  html: string;
}> = [];


function resetTransportTracking(): void {
  sendCount = 0;
  sentMessages.length = 0;
}


async function createTestDraft(
  purpose: EmailDraftPurpose,
  subject: string,
  body: string
): Promise<EmailDraft> {
  return draftEmail({
    to: "recipient@example.com",
    subject,
    body,
    html: `<p>${body}</p>`,
    purpose,
  });
}

// ==================================================
// TEST 1
// PROPERTY SUMMARY
// ==================================================

async function testPropertySummaryDraft(): Promise<void> {
  const draft =
    await createTestDraft(
      "property_summary",
      "Property Search Results",
      "Here are the property results from your recent search."
    );

  assert.equal(
    draft.purpose,
    "property_summary"
  );

  assert.equal(
    draft.subject,
    "Property Search Results"
  );

  assert.equal(
    draft.status,
    "pending_approval"
  );

  assert.equal(
    draft.to,
    "recipient@example.com"
  );

  assert.match(
    draft.body,
    /property results/i
  );

  console.log(
    "✓ Property summary draft passed"
  );
}


// ==================================================
// TEST 2
// MARKET REPORT
// ==================================================

async function testMarketReportDraft(): Promise<void> {
  const draft =
    await createTestDraft(
      "market_report",
      "Market Report — Irvine",
      [
        "Market Report — Irvine",
        "Median close price: $1,200,000",
        "Average close price: $1,250,000",
        "Average price per sqft: $650",
        "Average days on market: 24.5",
        "List-to-close ratio: 98.5%",
      ].join("\n")
    );

  assert.equal(
    draft.purpose,
    "market_report"
  );

  assert.equal(
    draft.status,
    "pending_approval"
  );

  assert.match(
    draft.subject,
    /market report/i
  );

  assert.match(
    draft.body,
    /median close price/i
  );

  assert.match(
    draft.body,
    /average days on market/i
  );

  assert.match(
    draft.body,
    /list-to-close ratio/i
  );

  console.log(
    "✓ Market report draft passed"
  );
}


// ==================================================
// TEST 3
// NEW LISTING ALERT
// ==================================================

async function testListingAlertDraft(): Promise<void> {
  const draft =
    await createTestDraft(
      "listing_alert",
      "New Property Listings",
      "Here are the latest listings matching your saved preferences."
    );

  assert.equal(
    draft.purpose,
    "listing_alert"
  );

  assert.equal(
    draft.status,
    "pending_approval"
  );

  assert.match(
    draft.subject,
    /new property listings/i
  );

  assert.match(
    draft.body,
    /matching your saved preferences/i
  );

  console.log(
    "✓ New listing alert draft passed"
  );
}


// ==================================================
// TEST 4
// RECOMMENDATION DIGEST
// ==================================================

async function testRecommendationDigestDraft(): Promise<void> {
  const draft =
    await createTestDraft(
      "recommendation_digest",
      "Property Recommendations",
      "Here are the properties selected based on your recent preferences and search activity."
    );

  assert.equal(
    draft.purpose,
    "recommendation_digest"
  );

  assert.equal(
    draft.status,
    "pending_approval"
  );

  assert.match(
    draft.subject,
    /property recommendations/i
  );

  assert.match(
    draft.body,
    /recent preferences/i
  );

  console.log(
    "✓ Recommendation digest draft passed"
  );
}


// ==================================================
// TEST 5
// DRAFT STARTS PENDING APPROVAL
// ==================================================

async function testDraftStartsPending(): Promise<void> {
  const draft =
    await createTestDraft(
      "property_summary",
      "Property Search Results",
      "Example property summary."
    );

  assert.equal(
    draft.status,
    "pending_approval"
  );

  assert.equal(
    draft.approvedAt,
    undefined
  );

  assert.equal(
    draft.sentAt,
    undefined
  );

  console.log(
    "✓ Draft starts pending approval"
  );
}


// ==================================================
// TEST 6
// PENDING DRAFT CANNOT SEND
// ==================================================

async function testPendingDraftBlocked(): Promise<void> {
  resetTransportTracking();

  const draft =
    await createTestDraft(
      "property_summary",
      "Property Search Results",
      "Example property summary."
    );

  await assert.rejects(
    async () => {
      await sendApprovedEmail(
        draft
      );
    },
    /explicit approval is required/i
  );

  assert.equal(
    sendCount,
    0
  );

  assert.equal(
    sentMessages.length,
    0
  );

  console.log(
    "✓ Pending draft blocked from sending"
  );
}


// ==================================================
// TEST 7
// APPROVED DRAFT CAN SEND
// ==================================================

async function testApprovedDraftSends(): Promise<void> {
  resetTransportTracking();

  const draft =
    await createTestDraft(
      "property_summary",
      "Property Search Results",
      "Example property summary."
    );

  const approved: EmailDraft = {
    ...draft,
    status: "approved",
    approvedAt: Date.now(),
  };

  await sendApprovedEmail(
    approved
  );

  assert.equal(
    sendCount,
    1
  );

  assert.equal(
    sentMessages.length,
    1
  );

  assert.equal(
    sentMessages[0].to,
    "recipient@example.com"
  );

  assert.equal(
    sentMessages[0].subject,
    "Property Search Results"
  );

  console.log(
    "✓ Approved draft sent successfully"
  );
}


// ==================================================
// TEST 8
// INVALID RECIPIENT
// ==================================================

async function testInvalidRecipient(): Promise<void> {
  await assert.rejects(
    async () => {
      await draftEmail({
        to: "not-an-email",
        subject:
          "Invalid Recipient Test",

        body:
          "This should fail.",

        html:
          "<p>This should fail.</p>",

        purpose:
          "property_summary",
      });
    },
    /valid recipient email address/i
  );

  console.log(
    "✓ Invalid recipient rejected"
  );
}


// ==================================================
// TEST 9
// EMPTY SUBJECT
// ==================================================

async function testEmptySubjectBlocked(): Promise<void> {
  resetTransportTracking();

  const draft =
    await createTestDraft(
      "property_summary",
      "Property Search Results",
      "Example property summary."
    );

  const invalidDraft: EmailDraft = {
    ...draft,
    subject: "",
    status: "approved",
    approvedAt: Date.now(),
  };

  await assert.rejects(
    async () => {
      await sendApprovedEmail(
        invalidDraft
      );
    },
    /missing a subject/i
  );

  assert.equal(
    sendCount,
    0
  );

  console.log(
    "✓ Empty email subject blocked"
  );
}


// ==================================================
// TEST 10
// EMPTY EMAIL CONTENT
// ==================================================

async function testEmptyContentBlocked(): Promise<void> {
  resetTransportTracking();

  const draft =
    await createTestDraft(
      "market_report",
      "Market Report — Irvine",
      "Example market report."
    );

  const invalidDraft: EmailDraft = {
    ...draft,
    html: "",
    status: "approved",
    approvedAt: Date.now(),
  };

  await assert.rejects(
    async () => {
      await sendApprovedEmail(
        invalidDraft
      );
    },
    /missing email content/i
  );

  assert.equal(
    sendCount,
    0
  );

  console.log(
    "✓ Empty email content blocked"
  );
}


// ==================================================
// TEST 11
// CORRECT RECIPIENT PASSED TO TRANSPORT
// ==================================================

async function testRecipientPassedToTransport(): Promise<void> {
  resetTransportTracking();

  const draft =
    await draftEmail({
      to:
        "market-recipient@example.com",

      subject:
        "Market Report — Irvine",

      body:
        "Market report.",

      html:
        "<p>Market report.</p>",

      purpose:
        "market_report",
    });

  const approved: EmailDraft = {
    ...draft,
    status:
      "approved",

    approvedAt:
      Date.now(),
  };

  await sendApprovedEmail(
    approved
  );

  assert.equal(
    sentMessages.length,
    1
  );

  assert.equal(
    sentMessages[0].to,
    "market-recipient@example.com"
  );

  console.log(
    "✓ Approved recipient passed to email transport"
  );
}


// ==================================================
// TEST 12
// FOUR SUPPORTED EMAIL PURPOSES
// ==================================================

async function testSupportedEmailPurposes(): Promise<void> {
  const purposes: EmailDraftPurpose[] = [
    "listing_alert",
    "market_report",
    "property_summary",
    "recommendation_digest",
  ];

  for (
    const purpose of purposes
  ) {
    const draft =
      await createTestDraft(
        purpose,
        `Test ${purpose}`,
        `Testing ${purpose}`
      );

    assert.equal(
      draft.purpose,
      purpose
    );

    assert.equal(
      draft.status,
      "pending_approval"
    );
  }

  console.log(
    "✓ All four Week 11 email purposes supported"
  );
}


// ==================================================
// RUN TEST SUITE
// ==================================================

async function run(): Promise<void> {
  console.log(
    "============================================"
  );

  console.log(
    "WEEK 11 - EMAIL AGENTS & SAFETY GUARDRAILS"
  );

  console.log(
    "============================================"
  );

  // Fake sender used by the email safety service.
  // No real Gmail credentials are required.
  process.env.EMAIL_USER =
    "sender@example.com";

  // Inject fake email transport.
  // This prevents the test suite from sending
  // real emails.
  setTestEmailTransport(
    async (payload) => {
      sendCount++;

      sentMessages.push({
        from:
          payload.from,

        to:
          payload.to,

        subject:
          payload.subject,

        html:
          payload.html,
      });
    }
  );

  try {
    await testPropertySummaryDraft();

    await testMarketReportDraft();

    await testListingAlertDraft();

    await testRecommendationDigestDraft();

    await testDraftStartsPending();

    await testPendingDraftBlocked();

    await testApprovedDraftSends();

    await testInvalidRecipient();

    await testEmptySubjectBlocked();

    await testEmptyContentBlocked();

    await testRecipientPassedToTransport();

    await testSupportedEmailPurposes();

    console.log(
      "============================================"
    );

    console.log(
      "✓ ALL WEEK 11 TESTS PASSED"
    );

    console.log(
      "============================================"
    );
  } finally {
    // Always restore the real transport.
    setTestEmailTransport(
      null
    );
  }
}


run().catch(
  (error) => {
    console.error(
      "✗ WEEK 11 TESTS FAILED:",
      error
    );

    process.exit(1);
  }
).finally(async () => {
    await closeDb();
    console.log("Database connection closed.");
  });