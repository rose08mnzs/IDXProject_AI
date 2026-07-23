import { getSession, updateSession, resetSession, clearMarketSession } from "../session/sessionManager";
import { parsePropertyQuery } from "../parser/propertyParser";
import { buildMarketReport } from "../services/marketAnalytics";
import type { MarketFilters, MarketReport } from "../types/marketAnalytics";

function extractUserText(message: string): string {
  const wrapped = message.match(/\):\s*(.*)$/s);
  return (wrapped?.[1] ?? message).trim();
}

function extractMonths(query: string): number {
  const match = query.match(
    /(?:past|last|over the last|for the last|in the last)\s+(\d{1,2})\s+months?/i
  );
  if (!match?.[1]) return 24;
  const months = Number(match[1]);
  return Number.isFinite(months) ? Math.min(Math.max(months, 1), 60) : 24;
}

function extractZip(query: string): string | null {
  const match = query.match(/\b\d{5}\b/);
  return match?.[0] ?? null;
}

function extractBareCity(text: string): string | null {
  const cleaned = text.trim();
  //console.log("extractBareCity DEBUG:", { query: text, cleaned });
  if (!cleaned) return null;
  if (/^[a-z][a-z\s'.-]+$/i.test(cleaned) && cleaned.split(/\s+/).length <= 3) {
    return cleaned;
  }
  return null;
}

function extractCityFromQuery(query: string): string | null {
  const normalized = query.trim().replace(/\s+/g, " ");
  const lower = normalized.toLowerCase();

  const idx = lower.lastIndexOf(" in ");
  //console.log("extractCityFromQuery DEBUG:", { query: normalized, lower, idx });
  if (idx !== -1) {
    let candidate = normalized.slice(idx + 4).trim();
    candidate = candidate.replace(/\b(?:over the last|past|last|for the last|in the last)\s+\d{1,2}\s+months?.*$/i, "");
    candidate = candidate.replace(/[?.!,]+$/g, "").trim();
    if (candidate) return candidate;
  }

  return null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function money(value: number | null): string {
  if (value === null || value === undefined) return "n/a";
  return `$${value.toLocaleString()}`;
}

function pct(value: number | null): string {
  if (value === null || value === undefined) return "n/a";
  return `${value.toFixed(1)}%`;
}

function formatTrend(report: MarketReport): string {
  if (report.trend.length === 0) return "No monthly trend data found.";

  return report.trend
    .slice(-6)
    .reverse()
    .map((row) => {
      const avgClose = toNumber(row.avgClosePrice);
      const avgPpsf = toNumber(row.avgPricePerSqft);
      const dom = toNumber(row.avgDaysOnMarket);

      const mom =
        row.momPriceChangePct === null
          ? ""
          : ` | MoM ${row.momPriceChangePct >= 0 ? "+" : ""}${row.momPriceChangePct.toFixed(1)}%`;

      const yoy =
        row.yoyPriceChangePct === null
          ? ""
          : ` | YoY ${row.yoyPriceChangePct >= 0 ? "+" : ""}${row.yoyPriceChangePct.toFixed(1)}%`;

      return `• ${row.month}: ${money(avgClose)} avg close, ${money(avgPpsf)} / sqft, ${dom !== null ? dom.toFixed(1) : "n/a"} DOM${mom}${yoy}`;
    })
    .join("\n");
}

function formatReport(report: MarketReport): string {
  const s = report.summary;

  if (!s || !report.inventory) {
    return `I could not find enough sold comps for that market.\n\nTry a city like Irvine, Pasadena, San Diego, or use a ZIP code.`;
  }

  const avgDays = toNumber(s.avgDaysOnMarket);
  const medianClose = toNumber(s.medianClosePrice);
  const avgClose = toNumber(s.avgClosePrice);
  const avgPpsf = toNumber(s.avgPricePerSqft);
  const listToClose = toNumber(s.listToClosePct);
  const activeToSold = toNumber(report.inventory.activeToSoldRatio);

  return [
    `📊 *Market Report — ${s.locationLabel}*`,
    ``,
    `Sold comps: *${s.soldCount.toLocaleString()}*`,
    `Median close price: *${money(medianClose)}*`,
    `Average close price: *${money(avgClose)}*`,
    `Average price per sqft: *${money(avgPpsf)}*`,
    `Average days on market: *${avgDays !== null ? avgDays.toFixed(1) : "n/a"}*`,
    `List-to-close ratio: *${pct(listToClose)}*`,
    `Inventory: *${report.inventory.activeCount.toLocaleString()}* active / *${report.inventory.soldCount.toLocaleString()}* sold`,
    activeToSold !== null
      ? `Active-to-sold ratio: *${activeToSold.toFixed(1)}*`
      : `Active-to-sold ratio: n/a`,
    ``,
    `*Trend*`,
    formatTrend(report),
    ``,
    report.narrative,
  ].join("\n");
}

export async function week5Skill(userId: string, message: string) {
  const userText = extractUserText(message);
  const lower = userText.trim().toLowerCase();
  const session = getSession(userId);

  if (lower === "resetMarket" || lower === "start over Market" || lower === "/resetM") {
    resetSession(userId);
    return {
      response: "Market analysis cleared. Which city, ZIP code, or property type should I analyze?",
      filters: null,
      report: null,
    };
  }

  const parsed = await parsePropertyQuery(userText);

  const explicitCity = parsed.city ?? extractCityFromQuery(userText) ?? null;
  const explicitZip = extractZip(userText);
  const bareCity = extractBareCity(userText);

  const hasExplicitLocation = Boolean(explicitCity || explicitZip);

  let city: string | null = null;

  // If user asked a fresh market question with a real city/ZIP, do not reuse old params.
  if (hasExplicitLocation) {
    city = explicitCity;
  } else if (session.marketAwaiting === "city") {
    city = bareCity;
  } else {
    city = null;
  }

  const filters: MarketFilters = {
    city,
    zip: explicitZip ?? (session.marketAwaiting === "city" ? (session.marketZip ?? null) : null),
    propertyType: parsed.type ?? (hasExplicitLocation ? null : session.marketPropertyType ?? null),
    months: extractMonths(userText),
  };

  console.log({
    city: filters.city,
    zip: filters.zip,
    propertyType: filters.propertyType,
    months: filters.months,
  });

  if (!filters.city && !filters.zip && !filters.propertyType) {
    updateSession(userId, {
      marketAwaiting: "city",
      marketCity: null,
      marketZip: null,
      marketPropertyType: null,
      marketMonths: filters.months,
      updatedAt: Date.now(),
    });

    return {
      response: "Which city, ZIP code, or property type should I analyze?",
      filters,
      report: null,
    };
  }

  // Save only the current market search, not the old one.
  updateSession(userId, {
    marketAwaiting: null,
    marketCity: filters.city,
    marketZip: filters.zip,
    marketPropertyType: filters.propertyType,
    marketMonths: filters.months,
    updatedAt: Date.now(),
  });

  const report = await buildMarketReport(filters);
  updateSession(userId, {
    marketAwaiting: null,
    marketCity: null,
    marketZip: null,
    marketPropertyType: null,
    marketMonths: null,
  });
  return {
    response: formatReport(report),
    filters,
    report,
  };
}