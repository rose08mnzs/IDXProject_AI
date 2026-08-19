import { parsePropertyQuery } from "../parser/propertyParser";
import { searchActiveListings, getSoldComps } from "../services/listings";
import { formatSearchResults, formatSoldCompCard } from "../services/format";
import { clearSession, getSession, updateSession, resetSession } from "../session/sessionManager";
import { rerankListings } from "../services/semanticSearch";

import type {
  AwaitingField,
  PropertyFilters,
  SoldRow,
  UserSession,
} from "../types/propertyFilters";

type AwaitingPrompt = Exclude<AwaitingField, null>;
type ActiveSearchResult = Awaited<ReturnType<typeof searchActiveListings>>;


function extractUserText(message: string): string {
  const wrapped = message.match(/\):\s*(.*)$/s);
  return (wrapped?.[1] ?? message).trim();
}


function parseMoney(text: string): number | null {
  const cleaned = text
    .trim()
    .toLowerCase()
    .replace(/\$/g, "")
    .replace(/,/g, "");

  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*([km])?$/i);

  if (!match) return null;

  let value = Number(match[1]);

  if (Number.isNaN(value)) return null;

   switch (match[2]?.toLowerCase()) {
    case "k":
    case "thousand":
      value *= 1_000;
      break;

    case "m":
    case "million":
      value *= 1_000_000;
      break;

    case "b":
    case "billion":
      value *= 1_000_000_000;
      break;
  }


  return Math.round(value);
}
function parseNumber(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function isNoPreference(text: string): boolean {
  return /^(any|no preference|doesn't matter|doesnt matter|dont care|either|flexible|whatever|nope)$/i.test(
    text.trim()
  );
}

function normalizeSession(session: UserSession): UserSession {
  return {
    ...session,
    city: session.city ?? null,
    maxPrice: session.maxPrice ?? null,
    beds: session.beds ?? null,
    baths: session.baths ?? null,
    sqft: session.sqft ?? null,
    type: session.type ?? null,
    pool: session.pool ?? null,
    hasView: session.hasView ?? null,
    maxHoa: session.maxHoa ?? null,
    awaiting: session.awaiting ?? null,
    lastResults: session.lastResults ?? [],
    updatedAt: session.updatedAt ?? Date.now(),

    cityAnswered: session.cityAnswered ?? false,
    priceAnswered: session.priceAnswered ?? false,
    bedsAnswered: session.bedsAnswered ?? false,
    bathsAnswered: session.bathsAnswered ?? false,
    typeAnswered: session.typeAnswered ?? false,

    semanticHint: session.semanticHint ?? null,
    searchMode: session.searchMode ?? null,
  };
}

function promptFor(field: AwaitingPrompt): string {
  switch (field) {
    case "city":
      return "Which city are you interested in? (Or reply 'any')";
    case "budget":
      return "What is your maximum budget?  (Or reply 'any')";
    case "beds":
      return "How many bedrooms do you need?  (Or reply 'any')";
    case "baths":
      return "How many bathrooms do you need?  (Or reply 'any')";
    case "type":
      return "Do you prefer single family, condo, townhome, or something else?  (Or reply 'any')";
  }
}

function nextMissingField(session: UserSession): AwaitingField {
    if (/*!session.city && !session.zip*/ !session.cityAnswered)
          return "city";

    if (!session.priceAnswered)
        return "budget";

    if (!session.bedsAnswered)
        return "beds";

    if (!session.bathsAnswered)
        return "baths";

    if (!session.typeAnswered)
        return "type";

    return null;
}

function toSearchFilters(session: UserSession): PropertyFilters {
  return {
    city: session.city ?? null,
    zip: session.zip ?? null,
    //months: 12,
    maxPrice: session.maxPrice ?? null,
    beds: session.beds ?? null,
    baths: session.baths ?? null,
    sqft: session.sqft ?? null,
    type: session.type ?? null,
    pool: session.pool ?? null,
    hasView: session.hasView ?? null,
    maxHoa: session.maxHoa ?? null,
  };
}

function describeFilters(filters: PropertyFilters): string {
  const parts = [
    filters.city ? `city=${filters.city}` : null,
    filters.zip ? `zip=${filters.zip}` : null,
    filters.maxPrice ? `maxPrice=${filters.maxPrice}` : null,
    filters.beds ? `beds=${filters.beds}` : null,
    filters.baths ? `baths=${filters.baths}` : null,
    filters.type ? `type=${filters.type}` : null,
    filters.pool ? `pool=${filters.pool}` : null,
    filters.hasView ? `view=${filters.hasView}` : null,
    filters.maxHoa ? `maxHoa=${filters.maxHoa}` : null,
  ];

  return parts.filter((v): v is string => Boolean(v)).join(", ");
}

function refineFromFollowUp(session: UserSession,parsed: PropertyFilters, message: string): UserSession {
  
  const trimmed = message.trim();

  switch (session.awaiting) {
    case "city":
      if (isNoPreference(trimmed)) {
        return {
          ...session,
          city: null,
          zip: null,
          cityAnswered: true,
          awaiting: null,
        };
      }
      
      return {
        ...session,
        city: (parsed.city ?? trimmed)|| null,
        zip: parsed.zip ?? session.zip,
        cityAnswered: true,
        awaiting: null,
      };

    case "budget":
      if (isNoPreference(trimmed)) {
        return {
          ...session,
          maxPrice: null,
          priceAnswered: true,
          awaiting: null,
        };
      }

      return {
        ...session,
        maxPrice: parseMoney(trimmed),//(parsed.maxPrice ?? parseNumber(trimmed)),
        priceAnswered: true,
        awaiting: null,
      };

    case "beds":
      if (isNoPreference(trimmed)) {
        return {
          ...session,
          beds: null,
          bedsAnswered: true,
          awaiting: null,
        };
      }

      return {
        ...session,
        beds: (parsed.beds ??  parseNumber(trimmed)),
        bedsAnswered: true,
        awaiting: null,
      };

    case "baths":
      if (isNoPreference(trimmed)) {
        return {
          ...session,
          baths: null,
          bathsAnswered: true,
          awaiting: null,
        };
      }

      return {
        ...session,
        baths: (parsed.baths ?? parseNumber(trimmed)),
        bathsAnswered: true,
        awaiting: null,
      };

    case "type":
      if (isNoPreference(trimmed)) {
        return {
          ...session,
          type: null,
          typeAnswered: true,
          awaiting: null,
        };
      }

      return {
        ...session,
        type: parsed.type,
        typeAnswered: true,
        awaiting: null,
      };

    default:
      return session;
  }
}

function refineWithKeywords(session: UserSession, message: string): UserSession {
  const text = message.toLowerCase();
  const updated: UserSession = { ...session };

  if (text.includes("cheaper") && session.maxPrice) {
    updated.maxPrice = Math.max(1, Math.round(session.maxPrice * 0.9));
  }

  if ((text.includes("more beds") || text.includes("more bedroom")) && session.beds) {
    updated.beds = session.beds + 1;
  }

  if (text.includes("pool")) {
    updated.pool = "True";
  }

  /*if (text.includes("view")) {
    updated.hasView = "True";
  }*/

  return updated;
}
//new 
function isSemanticStyleQuery(text: string): boolean {
  const semanticWords =
    /\b(charming|cozy|luxury|modern|updated|renovated|character|craftsman|mid-century|light-filled|bright|airy|spacious|elegant|stylish|private|serene|unique|dream home|open concept|open floor plan|quiet|peaceful|tree[-\s]?lined|neighborhood|natural light|mountain views?|ocean views?|beach|resort|retreat|entertaining|backyard|starter home|low maintenance|investment|fixer upper|villa|turnkey)\b/i;

  const structuredSignals =
    /(\d+\s*(?:bed|bath|br|bd)|\bunder\b|\$\d|hoa|max\s*hoa|sqft|square feet|\bpool\b)/i;

  return semanticWords.test(text) && !structuredSignals.test(text);
}

function extractSemanticHint(text: string): string | null {
  const semanticWords =
    /\b(charming|cozy|luxury|modern|updated|renovated|character|craftsman|mid-century|light-filled|bright|airy|spacious|elegant|stylish|private|serene|unique|dream home|open concept|open floor plan|quiet|peaceful|tree[-\s]?lined|neighborhood|natural light|mountain views?|ocean views?|beach|resort|retreat|entertaining|backyard|starter home|low maintenance|investment|fixer upper|villa|turnkey)\b/i;

  return semanticWords.test(text) ? text : null;
}

async function searchWithFallbacks(filters: PropertyFilters): Promise<{
  result: ActiveSearchResult | null;
  usedFilters: PropertyFilters;
}> {
  const attempts: PropertyFilters[] = [
    filters,
    { ...filters, baths: null },
    { ...filters, baths: null, type: null },
    { ...filters, baths: null, type: null, beds: null },
    { ...filters, baths: null, type: null, beds: null, sqft: null, maxHoa: null },
    { ...filters, baths: null, type: null, beds: null, sqft: null, maxHoa: null, hasView: null, pool: null },
  ];

  for (const attempt of attempts) {
    const result = await searchActiveListings(attempt, 1, 200);
    if (result.listings.length > 0) {
      return { result, usedFilters: attempt };
    }
  }

  return { result: null, usedFilters: filters };
}
function startFreshSemanticSearch(session: UserSession, semanticText: string,  parsed: PropertyFilters): UserSession {
  return {
    ...session,
    semanticHint: semanticText,
    searchMode: "semantic",

    city: parsed.city ?? null,
    zip: parsed.zip ?? null,
    maxPrice: parsed.maxPrice ?? null,
    beds: parsed.beds ?? null,
    baths: parsed.baths ?? null,
    sqft: parsed.sqft ?? null,
    type: parsed.type ?? null,
    pool: parsed.pool ?? null,
    hasView: parsed.hasView ?? null,
    maxHoa: parsed.maxHoa ?? null,

    cityAnswered: parsed.city !== null || parsed.zip !== null,
    priceAnswered: parsed.maxPrice !== null,
    bedsAnswered: parsed.beds !== null,
    bathsAnswered: parsed.baths !== null,
    typeAnswered: parsed.type !== null,

    awaiting: null,
    lastResults: [],
  };
}
export async function handleWeek4Conversation(
  userId: string,
  message: string,
): Promise<string> {
  const userText = extractUserText(message);
  const trimmed = userText;
  const lower = trimmed.toLowerCase();
  
  const parsed = await parsePropertyQuery(userText);
  if (lower === "reset" || lower === "start over" || lower === "/reset") {
    //clearSession(userId);
    resetSession(userId);
    return "Conversation cleared. Which city are you interested in?";
  }

  const existingSession = normalizeSession(getSession(userId));
  let session = existingSession;

  // const isSemantic = isSemanticStyleQuery(userText);
  // const hasHardFilters =
  //   Boolean(parsed.city ||
  //           parsed.zip ||
  //           parsed.maxPrice ||
  //           parsed.beds ||
  //           parsed.baths ||
  //           parsed.sqft ||
  //           parsed.maxHoa);

  //if (isSemantic && !hasHardFilters) {
    //session.semanticHint = userText ?? session.semanticHint;
    //session.searchMode = "semantic";
   // session = startFreshSemanticSearch(session, userText, parsed);
    // updateSession(userId, {
    //   ...session,
    //   awaiting: "city",
    //   updatedAt: Date.now(),
    // });
    // return "Which city are you interested in? (Or reply 'any')";
    //}
    const wasAwaiting = Boolean(session.awaiting);
    if (session.awaiting) {
        session = normalizeSession(refineFromFollowUp(session,parsed, trimmed));
    }

    const semanticHint = extractSemanticHint(userText);
    // Only replace the hint if this message actually contains one.
    if (semanticHint) {
        session.semanticHint = semanticHint;
    }
    session.searchMode = session.semanticHint ? "semantic" : "structured";
    // if (isSemantic) {
    //     session.semanticHint = userText;
    //     session.searchMode = "semantic";
    // }
    // else {
    //     session.semanticHint = null;
    //     session.searchMode = "structured";
    // }


  
  
  const isNewSearch =
    !wasAwaiting &&
    (
      parsed.city !== null ||
      parsed.zip !== null ||
      parsed.maxPrice !== null ||
      parsed.beds !== null ||
      parsed.baths !== null ||
      parsed.type !== null
    );

  // if (isNewSearch && !isSemantic) {
  //   session.semanticHint = null;
  //   session.searchMode = "structured";
  // }

  if (isNewSearch) {
    // Clear optional filters from any previous search
    session.sqft = null;
    session.pool = null;
    session.hasView = null;
    session.maxHoa = null;

    // Reset answered flags for required fields
    session.cityAnswered = parsed.city !== null || parsed.zip !== null ? true : session.cityAnswered;
    session.priceAnswered = parsed.maxPrice !== null ? true : session.priceAnswered;
    session.bedsAnswered = parsed.beds !== null ? true : session.bedsAnswered;
    session.bathsAnswered = parsed.baths !== null ? true : session.bathsAnswered;
    session.typeAnswered = parsed.type !== null ? true : session.typeAnswered;


    // Also clear any previous search results
    session.lastResults = [];
  }

  session = normalizeSession({
    ...session,
    city: parsed.city ?? session.city,
     zip: parsed.zip ?? session.zip,
    maxPrice: parsed.maxPrice ?? session.maxPrice,
    beds: parsed.beds ?? session.beds,
    baths: parsed.baths ?? session.baths,
    sqft: parsed.sqft ?? session.sqft,
    type: parsed.type ?? session.type,
    pool: parsed.pool ?? session.pool,
    hasView: parsed.hasView ?? session.hasView,
    maxHoa: parsed.maxHoa ?? session.maxHoa,
    
    cityAnswered: parsed.city !== null || parsed.zip !== null ? true : session.cityAnswered,
    priceAnswered: parsed.maxPrice !== null ? true : session.priceAnswered,
    bedsAnswered: parsed.beds !== null ? true : session.bedsAnswered,
    bathsAnswered: parsed.baths !== null ? true : session.bathsAnswered,
    typeAnswered: parsed.type !== null ? true : session.typeAnswered,
    

    awaiting: null,
    step: (session.step ?? 0) + 1,
    lastResults: session.lastResults,
    updatedAt: Date.now(),
  });

  session = normalizeSession(refineWithKeywords(session, userText));

  const missing = nextMissingField(session);
  if (missing) {
    updateSession(userId, {
      ...session,
      awaiting: missing,
      updatedAt: Date.now(),
    });

    return promptFor(missing);
  }

  const filters = toSearchFilters(session);
  const { result, usedFilters } = await searchWithFallbacks(filters);

  const soldComps: SoldRow[] = session.city ? await getSoldComps(session.city, 12) : [];

  if (!result) {
    updateSession(userId, {
      ...session,
      awaiting: null,
      lastResults: [],
      updatedAt: Date.now(),
    });

    return `I could not find matching homes for ${session.city ?? "your search"}. Try widening the budget or removing one filter.`;
  }
  //console.log("Semantic Hint:", session.semanticHint);
  const rankedListings = await rerankListings(result.listings, session.semanticHint );

  //console.log("Candidates:", result.listings.length);
  const finalResult = {
      ...result,
      listings: rankedListings.slice(0, 5),
  };
  updateSession(userId, {
    ...session,
    awaiting: null,
    lastResults: finalResult.listings,
    updatedAt: Date.now(),
  });

  let response = `Here are your top matches using ${describeFilters(usedFilters)}:\n\n`;
  response += formatSearchResults(finalResult.listings, finalResult.page, finalResult.totalHint);

  if (session.semanticHint) {
    response += `\n\nSemantic preference noted: "${session.semanticHint}"`;
  }
  if (soldComps.length > 0) {
    response += "\n\nRecent sold comps:\n\n";
    response += soldComps.slice(0, 3).map(formatSoldCompCard).join("\n\n");
  }

  response += "\n\nYou can reply with: cheaper, more beds, with pool, with view, or reset.";

  return response;
}