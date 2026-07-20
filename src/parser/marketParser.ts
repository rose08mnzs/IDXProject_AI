import type { MarketFilters } from "../types/marketAnalytics";

const PROPERTY_TYPE_MAP: Record<string, string> = {
  condo: "Condominium",
  condominium: "Condominium",
  townhome: "Townhouse",
  townhouse: "Townhouse",
  "single family": "SingleFamilyResidence",
  "single-family": "SingleFamilyResidence",
  home: "SingleFamilyResidence",
  house: "SingleFamilyResidence",
  land: "UnimprovedLand",
};

export function parseMarketQuery(query: string): MarketFilters {
  const cleaned = query.trim();

  const cityMatch = cleaned.match(
    /(?:in|for|at|around)\s+([A-Za-z][A-Za-z\s'.-]+?)(?=\s+(?:market|stats?|analytics|trend|report|compare|comparison|over|for|during|this|past|last|show|tell|give|is|are)|[?.!,]|$)/i
  );

  const zipMatch = cleaned.match(/\b(\d{5})(?:-\d{4})?\b/);

  const monthsMatch = cleaned.match(
    /(?:past|last|over the last|for the last)\s+(\d{1,2})\s+months?/i
  );

  const lower = cleaned.toLowerCase();
  const typeKey = Object.keys(PROPERTY_TYPE_MAP).find((k) => lower.includes(k));

  return {
    city: cityMatch?.[1]?.trim().replace(/\s+/g, " ") ?? null,
    zip: zipMatch?.[1] ?? null,
    propertyType: typeKey ? PROPERTY_TYPE_MAP[typeKey] : null,
    months: monthsMatch ? Math.max(1, Math.min(24, Number(monthsMatch[1]))) : 12,
  };
}