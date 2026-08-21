import { query } from "../../config/db";
import {getSession,updateSession,} from "../session/sessionManager";
import {draftEmail,sendApprovedEmail,} from "../services/email";
import {formatListingCard,} from "../services/format";
import {week5Skill,} from "./week5Skill";
import type {EmailDraftPurpose,} from "../agents/types";
import type {EmailDraft,} from "../agents/types";
import type {ListingRow,} from "../types/propertyFilters";
import type {MarketReport,} from "../types/marketAnalytics";
import {getPhotoUrls as parsePhotoUrls,isValidPhotoUrl,} from "../utils/photos";
function extractUserText(message: string): string {
  const wrapped = message.match(/\):\s*(.*)$/s);

  return (wrapped?.[1] ?? message).trim();
}

function extractEmailAddress(text: string): string | null {
  const match = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);

  return match?.[0] ?? null;
}

function isApprovalCommand(text: string): boolean {
  const normalized = text.trim().toLowerCase();

  return (
    normalized === "approve email" ||
    normalized === "approve" ||
    normalized === "send email" ||
    normalized === "send it" ||
    normalized === "yes, send it" ||
    normalized === "yes send it"
  );
}

function isCancelCommand(text: string): boolean {
  const normalized = text.trim().toLowerCase();

  return (
    normalized === "cancel email" ||
    normalized === "cancel" ||
    normalized === "discard email" ||
    normalized === "discard it" ||
    normalized === "no, cancel"
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "N/A";
  }

  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function getPurpose(text: string): EmailDraftPurpose {
  const lower = text.toLowerCase();

  if (/\brecommendation\b|\brecommendations\b|\brecommended\b|\bsimilar homes?\b|\bsimilar properties\b/.test(lower)) {
    return "recommendation_digest";
  }

  if (/\bmarket report\b|\bmarket analysis\b|\bmarket summary\b|\bmarket trends?\b|\bweekly market\b/.test(lower)) {
    return "market_report";
  }

  if (/\balert\b|\bnew listings?\b|\blisting alert\b/.test(lower)) {
    return "listing_alert";
  }

  if (/\bproperty summary\b|\bproperty results\b|\blisting results\b|\bmatching listings\b|\bsearch results\b|\bthese listings\b|\bthese properties\b/.test(lower)) {
    return "property_summary";
  }
  if (/\b(email|send)\b/i.test(text) && /\bresults?\b/i.test(text)) {
    return "property_summary";
  }
  return null;
}

function purposeLabel(purpose: EmailDraftPurpose): string {
  switch (purpose) {
    case "listing_alert":
      return "Listing Alert";

    case "market_report":
      return "Market Report";

    case "property_summary":
      return "Property Summary";

    case "recommendation_digest":
      return "Recommendation Digest";
  }
}

function buildListingHtml(listing: ListingRow): string {
  const card = formatListingCard(listing);

  return `
    <div style="
      border:1px solid #dddddd;
      border-radius:8px;
      padding:16px;
      margin-bottom:16px;
      font-family:Arial,sans-serif;
    ">
      <pre style="
        font-family:Arial,sans-serif;
        white-space:pre-wrap;
        margin:0;
      ">${escapeHtml(card)}</pre>
    </div>
  `;
}

async function getPhotoUrls(listings: ListingRow[]): Promise<Map<string, string[]>> {
  const map =    new Map<string, string[]>();

  if (!listings.length) {
    return map;
  }

  const ids = listings.map((listing) => listing.L_ListingID);

  const placeholders = ids.map(() => "?").join(",");

  const rows =
    await query<{
      L_ListingID: string;
      L_Photos: string | null;
    }>(
      `
      SELECT
        L_ListingID,
        L_Photos
      FROM rets_property
      WHERE L_ListingID IN (${placeholders})
      `,
      ids
    );

  for (const row of rows) {
    const candidateUrls = parsePhotoUrls(row.L_Photos);

    const validUrls: string[] = [];

    for (const url of candidateUrls) {
      // Stop once we have enough usable photos.
      if (validUrls.length >= 3) {
        break;
      }

      const valid = await isValidPhotoUrl(url);

      if (valid) {
        validUrls.push(url);
      }
    }

    map.set(row.L_ListingID, validUrls);
  }

  return map;
}

async function buildPropertyEmail(purpose: EmailDraftPurpose,listings: ListingRow[]): Promise<{
  subject: string;
  body: string;
  html: string;
}> {
  const limited = listings.slice(0, 5);

  const photoMap = await getPhotoUrls(limited);

  const label =purposeLabel(purpose);

  const introText =
    purpose === "listing_alert"
      ? "Here are the latest listings matching your saved preferences."
      : purpose === "recommendation_digest"
        ? "Here are the properties selected based on your recent preferences and search activity."
        : "Here are the property results from your recent search.";

  const bodyParts: string[] = [
    label,
    "",
    introText,
    "",
    `Showing ${limited.length} of your top matching properties.`,
    "",
  ];

  const htmlParts: string[] = [
    `
    <div style="
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      color: #222;
      line-height: 1.5;
    ">
      <h2 style="
        margin-bottom: 8px;
        color: #1f2937;
      ">
        ${escapeHtml(label)}
      </h2>

      <p style="
        margin-top: 0;
        color: #555;
      ">
        ${escapeHtml(introText)}
      </p>

      <p style="
        color: #777;
        font-size: 14px;
      ">
        Showing ${limited.length} of your top matching properties.
      </p>
    `,
  ];

  for (const listing of limited) {
    bodyParts.push(formatListingCard(listing),"");

    htmlParts.push(buildListingHtml(listing));

    const photos = photoMap.get(listing.L_ListingID) ?? [];

    if (photos.length > 0) {
      htmlParts.push(`
        <div style="
          margin: 0 0 24px 0;
        ">
          ${photos
            .map(
              (url) => `
                <a
                  href="${escapeHtml(url)}"
                  target="_blank"
                  rel="noopener noreferrer"
                  style="
                    display: inline-block;
                    margin: 0 8px 8px 0;
                  "
                >
                  <img
                    src="${escapeHtml(url)}"
                    alt="Property photo"
                    width="220"
                    style="
                      display: block;
                      border-radius: 8px;
                      border: 1px solid #ddd;
                    "
                  />
                </a>
              `
            )
            .join("")}
        </div>
      `);
    }
  }

  htmlParts.push(`
      <hr style="
        border: 0;
        border-top: 1px solid #e5e7eb;
        margin: 30px 0 16px;
      ">

      <p style="
        color: #777;
        font-size: 12px;
        margin-bottom: 0;
      ">
        This email was generated from your recent property search.
      </p>
    </div>
  `);

  const subject = purpose === "listing_alert" ? "New Property Listings"
      : purpose === "recommendation_digest" ? "Property Recommendations"
      : "Property Search Results";

  return {
    subject,
    body: bodyParts.join("\n"),
    html: htmlParts.join("\n"),
  };
}


function buildMarketEmail(report: MarketReport): {
  subject: string;
  body: string;
  html: string;
} {
  const summary = report.summary;

  if (!summary) {
    throw new Error("No market summary is available." );
  }

  const lines: string[] = [
    `Market Report — ${summary.locationLabel}`,
    "",
    `Sold comps: ${summary.soldCount.toLocaleString()}`,
    `Median close price: ${money(summary.medianClosePrice)}`,
    `Average close price: ${money(summary.avgClosePrice)}`,
    `Average price per sqft: ${money(summary.avgPricePerSqft)}`,
    `Average days on market: ${
      summary.avgDaysOnMarket !== null
        ? summary.avgDaysOnMarket.toFixed(1)
        : "N/A"
    }`,
    `List-to-close ratio: ${
      summary.listToClosePct !== null
        ? `${summary.listToClosePct.toFixed(1)}%`
        : "N/A"
    }`,
    "",
    "Inventory",
    `Active listings: ${report.inventory?.activeCount.toLocaleString() ?? "N/A"}`,
    `Sold comps: ${report.inventory?.soldCount.toLocaleString() ?? "N/A"}`,
    `Active-to-sold ratio: ${
      report.inventory?.activeToSoldRatio !== null &&
      report.inventory?.activeToSoldRatio !== undefined
        ? report.inventory.activeToSoldRatio.toFixed(1)
        : "N/A"
    }`,
    "",
    "Trend",
  ];

  for (const row of report.trend.slice(-12)) {
    lines.push(
      `${row.month}: ${money(row.avgClosePrice)} avg close | ${money(row.avgPricePerSqft)}/sqft | ${
        row.avgDaysOnMarket !== null
          ? `${row.avgDaysOnMarket.toFixed(1)} DOM`
          : "N/A DOM"
      }`
    );
  }

  lines.push("","Narrative",report.narrative);

  const subject =`Market Report — ${summary.locationLabel}`;

  const escapedLines =lines.map((line) => escapeHtml(line)).join("<br>");

  return {
    subject,
    body: lines.join("\n"),
    html: `
      <div style="
        font-family:Arial,sans-serif;
        max-width:800px;
        margin:auto;
      ">
        <h2>
          ${escapeHtml(subject)}
        </h2>

        <div style="
          line-height:1.7;
          background:#f7f7f7;
          padding:16px;
          border-radius:8px;
        ">
          ${escapedLines}
        </div>

        <p style="
          color:#666;
          font-size:12px;
        ">
          Generated from california_sold market analytics.
        </p>
      </div>
    `,
  };
}

function buildPreview(draft: EmailDraft): string {
  return [
    "📧 Email Draft",
    "",
    `To: ${draft.to}`,
    `Subject: ${draft.subject}`,
    `Purpose: ${purposeLabel(draft.purpose)}`,
    `Status: ${draft.status}`,
    "",
    "Preview:",
    draft.body
      .slice(0, 1800),
    "",
    "No email has been sent.",
    "",
    'Reply "approve email" to send it.',
    'Reply "cancel email" to discard it.',
  ].join("\n");
}

async function createEmailDraft(userId: string,userText: string): Promise<string> {
  const session = getSession(userId);

  const recipient = extractEmailAddress(userText) ?? process.env.EMAIL_DEFAULT_TO ?? null;

  if (!recipient) {
  updateSession(userId, {
    emailAwaiting: "recipient",
    pendingEmailRequest: userText,
    updatedAt: Date.now(),
  });

  return [
    "I can prepare the email draft.",
    "",
    "Please provide the recipient email address.",
  ].join("\n");
}

  const purpose = getPurpose(userText);

  let content: {
    subject: string;
    body: string;
    html: string;
  };
  if (!purpose) {
  return [
    "I can email:",
    "",
    "• Property results",
    "• Market reports",
    "• Listing alerts",
    "• Recommendation digests",
    "",
    "Please specify which one you want to email.",
  ].join("\n");
}

  if (purpose === "market_report") {
    const marketQuery = /\b(?:past|last|over the last|for the last|in the last)\s+\d{1,2}\s+months?\b/i.test(userText)
        ? userText : `${userText} past 12 months`;

    const market = await week5Skill(userId, marketQuery);

    if (!market.report) { return market.response; }

    content = buildMarketEmail( market.report );
  } 
  else {
    if (session.lastResults.length === 0 ) {
      return [
        "I need a completed property search first.",
        "",
        "Run a property search, then ask me to email the property summary or recommendations.",
      ].join("\n");
    }

    content = await buildPropertyEmail(purpose,session.lastResults);
  }

  const draft =
    await draftEmail({
      to: recipient,
      subject: content.subject,
      body: content.body,
      html: content.html,
      purpose,
    });

  updateSession(userId, {
      pendingEmailDraft: draft,
      updatedAt: Date.now(),
    }
  );

  return buildPreview(draft);
}

async function approvePendingEmail(userId: string): Promise<string> {
  const session = getSession(userId);

  const pending = session.pendingEmailDraft;

  if (!pending) {
    return "There is no pending email draft to approve.";
  }

  if (pending.status !== "pending_approval" ) {
    return `The current email draft is already ${pending.status}.`;
  }

  const approved: EmailDraft = { ...pending, status: "approved", approvedAt: Date.now(),};

  updateSession(
    userId,
    {
      pendingEmailDraft:approved,
      updatedAt:Date.now(),
    }
  );

  try {
    await sendApprovedEmail(approved );

    const sent: EmailDraft = {...approved, status: "sent", sentAt: Date.now(), };

    updateSession(
      userId,
      {
        pendingEmailDraft: null,
        updatedAt: Date.now(),
      }
    );

    return [
      "✅ Email sent successfully.",
      "",
      `To: ${sent.to}`,
      `Subject: ${sent.subject}`,
    ].join("\n");
  } catch (error) {
    // Revert to pending so the user can retry.
    updateSession(
      userId,
      {
        pendingEmailDraft: { ...approved, status:"pending_approval",approvedAt:undefined,},
        updatedAt: Date.now(),
      }
    );

    const message = error instanceof Error ? error.message : "Unknown email sending error.";

    console.error( "Week 11 email send failed:", message );

    return [
      "I could not send the approved email.",
      "",
      `Reason: ${message}`,
      "",
      "The draft is still pending approval.",
    ].join("\n");
  }
}

function cancelPendingEmail(userId: string): string {
  const session = getSession(userId);

  const pending = session.pendingEmailDraft;

  if (!pending) {
    return "There is no pending email draft to cancel.";
  }

  updateSession(
    userId,
    {
      pendingEmailDraft: null,
      updatedAt: Date.now(),
    }
  );

  return [
    "🗑️ Email draft cancelled.",
    "",
    `Subject: ${pending.subject}`,
  ].join("\n");
}

export async function week11Skill(userId: string,message: string): Promise<{
  response: string;draft?: EmailDraft | null;}> {

  const userText = extractUserText(message);
  const session = getSession(userId);
  const recipient =extractEmailAddress(userText);

  // EMAIL RECIPIENT FOLLOW-UP
  if (session.emailAwaiting === "recipient" && recipient) {
    const originalRequest = session.pendingEmailRequest;

    if (!originalRequest) {
      updateSession(userId, {emailAwaiting: null,pendingEmailRequest: null,});

      return {
        response:
          "I lost the original email request. Please ask me to create the email again.",
        draft: null,
      };
    }

    updateSession(userId, {emailAwaiting: null,pendingEmailRequest: null,});

    const combinedRequest = `${originalRequest} to ${recipient}`;

    const response = await createEmailDraft(userId,combinedRequest );

    return {
      response,
      draft:
        getSession(userId)
          .pendingEmailDraft ??
        null,
    };
  }
  // EMAIL PURPOSE FOLLOW-UP
  if (session.emailAwaiting === "purpose") {
    const lower = userText.toLowerCase();

    let purpose:
      | EmailDraftPurpose
      | null = null;

    if (/\bproperty results?\b|\bproperty summary\b|\blisting results?\b|\bsearch results?\b|\bmatching listings?\b/.test(lower)) {
      purpose = "property_summary";
    } 
    else if (/\bmarket report\b|\bmarket summary\b|\bmarket trends?\b/.test(lower)) {
      purpose ="market_report";
    } 
    else if (/\blisting alerts?\b|\bnew listings?\b|\balerts?\b/.test(lower)) {
      purpose = "listing_alert";
    } 
    else if (/\brecommendation\b|\brecommendations\b|\brecommendation digest\b|\bsimilar homes?\b|\bsimilar properties\b/.test(lower)) {
      purpose = "recommendation_digest";
    }

    if (!purpose) {
      updateSession(userId, {emailAwaiting: "purpose", pendingEmailRequest: userText,
        updatedAt: Date.now(),
      });

      return [
        "I can email:",
        "",
        "• Property results",
        "• Market reports",
        "• Listing alerts",
        "• Recommendation digests",
        "",
        "Please specify which one you want to email.",
      ].join("\n");
    }

    updateSession(userId, {
      emailAwaiting: null,
      pendingEmailRequest: null,
      updatedAt: Date.now(),
    });

    const requestWithPurpose = `${purpose} email`;

    const response = await createEmailDraft( userId, requestWithPurpose);

    return {
      response,
      draft: getSession(userId).pendingEmailDraft ?? null,};
  }

  if (isApprovalCommand(userText )) {
    return {
      response: await approvePendingEmail(userId ),
      draft:getSession(userId).pendingEmailDraft ?? null,
    };
  }

  if (isCancelCommand(userText)) {
    return {
      response:cancelPendingEmail(userId),
      draft: null,
    };
  }

  const response = await createEmailDraft(userId, userText);

  return {
    response,
    draft: getSession(userId).pendingEmailDraft ?? null,
  };
}

export function hasPendingEmailDraft(userId: string): boolean {
  return Boolean(getSession(userId).pendingEmailDraft );
}