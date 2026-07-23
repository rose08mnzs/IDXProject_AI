import { createEmptyPropertyFilters, type PropertyFilters } from "../types/propertyFilters";

const TYPE_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\bboat[\s-]*(?:slips?|docks?)\b/i, value: "BoatSlip" },
  { pattern: /\bcabins?\s*\b/i, value: "Cabin" },
  { pattern: /\bcondo(?:minium)?s?\b/i, value: "Condominium" },
  { pattern: /\bco[\s-]*ownerships?\b/i, value: "CoOwnership" },
  { pattern: /\bduplexs?\b/i, value: "Duplex" },
  { pattern: /\bfarms?\s*\b/i, value: "Farm" },
  { pattern: /\blofts?\s*\b/i, value: "Loft" },
  { pattern: /\bmanufactured[\s-]*home\b|\bmanufacturedhome\b/i, value: "ManufacturedHome" },
  { pattern: /\bmanufactured[\s-]*lands?\b|\bmanufactured[\s-]*on[\s-]*lands?\b/i, value: "ManufacturedOnLand" },
  { pattern: /\bmixed[\s-]*uses?\b|\bmixeduse\b/i, value: "MixedUse" },
  { pattern: /\bmobile[\s-]*homes?\b/i, value: "MobileHome" },
  { pattern: /\bown[\s-]*your[\s-]*own\b/i, value: "OwnYourOwn" },
  { pattern: /\bquadruplexs?\b/i, value: "Quadruplex" },
  { pattern: /\bsingle[\s-]*family(?:[\s-]*(?:residence|residential))?\b/i, value: "SingleFamilyResidence" },
  { pattern: /\bstock[\s-]*cooperative\b/i, value: "StockCooperative" },
  { pattern: /\bstudios?\b/i, value: "Studio" },
  { pattern: /\btime[\s-]*shares?\b/i, value: "Timeshare" },
  { pattern: /\btown[\s-]*houses?\b|\btown[\s-]*homes?\b/i, value: "Townhouse" },
  { pattern: /\btriplexs?\b/i, value: "Triplex" },

];

function normalizeQuery(query: string): string {
  return query
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumberLike(raw: string, suffix?: string): number {
  const cleaned = raw.replace(/,/g, "").trim();
  let value = Number(cleaned);
  if (Number.isNaN(value)) return NaN;

  const normalizedSuffix = (suffix || "").toLowerCase();
  if (normalizedSuffix === "k") value *= 1000;
  if (normalizedSuffix === "m") value *= 1000000;
  return Math.round(value);
}

function firstMatch(patterns: RegExp[], text: string): RegExpMatchArray | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match;
  }
  return null;
}

function extractCity(query: string): string | null {
  const patterns = [
    /\b(?:in|near|around|at|within)\s+(?:the\s+)?([a-z][a-z\s'.-]+?)(?=\s+(?:under|below|less than|over|above|with|featuring|having|max(?:imum)?|min(?:imum)?|between|from|to|for|on|and)\b|[?.!,;]|$)/i,
    /\b(?:located in|based in)\s+([a-z][a-z\s'.-]+?)(?=\s+(?:under|below|less than|over|above|with|featuring|having|max(?:imum)?|min(?:imum)?|between|from|to|for|on|and)\b|[?.!,;]|$)/i,
  ];

  const match = firstMatch(patterns, query);
  if (!match?.[1]) return null;

  const city = match[1].trim();
  //console.log("extractCity DEBUG:", { query, match , city});
  return city.length ? city : null;
}

function extractPrice(query: string): number | null {
  const patterns = [
    /\b(?:under|below|less than|up to|max(?:imum)?|price(?: of)?|priced (?: at)?|asking|budget(?: of)?|for)\s*\$?\s*([\d,.]+)\s*([km])?\b/i,
    /\$\s*([\d,.]+)\s*([km])?\b/i,
  ];

  const match = firstMatch(patterns, query);
  if (!match?.[1]) return null;

  const value = parseNumberLike(match[1], match[2]);
  return Number.isFinite(value) ? value : null;
}

function extractBeds(query: string): number | null {
  const match = query.match( /\b(\d+)[\s-]*\+?[\s-]*(?:bed(?:[\s-]?room)?s?|br|bdrm|bd)\b/i);
  if (!match?.[1]) return null;
  return Number(match[1]);
}

function extractBaths(query: string): number | null {
  const match = query.match(/\b(\d+)[\s-]*\+?[\s-]*(?:bath(?:[\s-]?room)?s?|ba)\b/i);
  if (!match?.[1]) return null;
  return Number(match[1]);
}

function extractSqft(query: string): number | null {
 const match = query.match(/\b(\d[\d,]*)[\s-]*\+?[\s-]*(?:(?:square|sq)(?:[\s-]?(?:foot|feet|ft))?|sf)\b/i);
 if (!match?.[1]) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function extractMaxHoa(query: string): number | null {
  const patterns = [
    /\b(?:hoa|association(?: fee)?|monthly hoa|dues)\s*(?:under|below|less than|max(?:imum)?|<=)?\s*\$?\s*([\d,.]+)\s*([km])?\b/i,
    /\bmax\s+hoa\s*\$?\s*([\d,.]+)\s*([km])?\b/i,
  ];

  const match = firstMatch(patterns, query);
  if (!match?.[1]) return null;

  const value = parseNumberLike(match[1], match[2]);
  return Number.isFinite(value) ? value : null;
}

function extractType(query: string): string | null {
  for (const item of TYPE_PATTERNS) {
    if (item.pattern.test(query)) return item.value;
  }
  return null;
}

function extractBooleanFlag(query: string, word: string): "True" | null {
  const positive = new RegExp(`\\b${word}\\b`, "i");
  const negative = new RegExp(`\\b(?:no|without|not|no\\s+${word}|without\\s+${word})\\b`, "i");

  if (positive.test(query) && !negative.test(query)) return "True";
  return null;
}
function extractMonths(query: string): number {
  const match = query.match(
    /(?:past|last|over the last|for the last|in the last)\s+(\d{1,2})\s+months?/i
  );
  if (!match?.[1]) return 12;
  const months = Number(match[1]);
  return Number.isFinite(months) ? Math.min(Math.max(months, 1), 60) : 12;
}

function extractZip(query: string): string | null {
  const match = query.match(/\b\d{5}\b/);
  return match?.[0] ?? null;
}
export async function parsePropertyQuery(query: string): Promise<PropertyFilters> {
  const normalized = normalizeQuery(query);

  return {
    ...createEmptyPropertyFilters(),
    city: extractCity(normalized),
    zip: extractZip(normalized),
    months: extractMonths(normalized),
    maxPrice: extractPrice(normalized),
    beds: extractBeds(normalized),
    baths: extractBaths(normalized),
    sqft: extractSqft(normalized),
    type: extractType(normalized),
    pool: extractBooleanFlag(normalized, "pool"),
    hasView: extractBooleanFlag(normalized, "view"),
    maxHoa: extractMaxHoa(normalized),
  };
}