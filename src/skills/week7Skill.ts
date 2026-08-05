import { parsePropertyQuery } from "../parser/propertyParser";
import { getSession, updateSession } from "../session/sessionManager";
import { recommendSimilarListings } from "../services/recommendation";

function extractUserText(message: string): string {
  const wrapped = message.match(/\):\s*(.*)$/s);
  return (wrapped?.[1] ?? message).trim();
}

function looksLikeRecommendationQuery(text: string): boolean {
  return /\b(similar|recommend(?:ation)?|comparable|compare|comp[s]?|what else like this|other like this|closest match|best match|like|alternatives?)\b/i.test(
    text
  );
}

function extractListingId(text: string): string | null {
  const match =
    text.match(/\b(?:listing\s*id|id)\s*[:#]?\s*(\d+)\b/i) ||
    text.match(/\b(\d{6,})\b/);
  return match?.[1] ?? null;
}

function cleanAddress(raw: string): string {
  return raw
    .replace(/[.?!]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAddress(text: string): string | null {
  const match = text.match(/\b(?:at|for|like)\s+(.+?)(?:\s+in\s+[A-Za-z\s]+|$)/i);
  if (!match?.[1]) return null;
  return cleanAddress(match[1]);
}

function extractStreetOnly(address: string): string {
  // "32331 Tannat, Temecula" -> "32331 Tannat"
  // "32331 Tannat St, Temecula" -> "32331 Tannat St"
  return address.split(",")[0].trim();
}

export async function week7Skill(userId: string, message: string) {
  const userText = extractUserText(message);
  const session = getSession(userId);
  const parsed = await parsePropertyQuery(userText);

  const explicitListingId = extractListingId(userText);
  const explicitAddress = extractAddress(userText);
  const explicitCity = parsed.city ?? null;
  const explicitZip = parsed.zip ?? null;

  const fallbackListingId =
    !explicitListingId && !explicitAddress && !explicitCity && session.lastResults.length > 0
      ? session.lastResults[0].L_ListingID
      : undefined;

  if (
    !looksLikeRecommendationQuery(userText) &&
    !explicitListingId &&
    !explicitAddress &&
    !explicitCity &&
    !fallbackListingId
  ) {
    return {
      response:
        "Please give me a listing ID, an address, a city, or ask for something like “similar homes to this”.",
      target: null,
      recommendations: [],
    };
  }

  try {
    const result = await recommendSimilarListings({
      listingId: explicitListingId ?? undefined,
      address: explicitAddress ?? undefined,
      city: explicitCity ?? undefined,
      zip: explicitZip ?? undefined,
      fallbackListingId,
      topK: 5,
    });

    updateSession(userId, {
      lastResults: result.recommendations.map((item) => item.listing),
      updatedAt: Date.now(),
    });

    return result;
  } catch (error) {
    console.error("Week 7 recommendation failed:", error);

    // If the address lookup failed, try a broader street-only fallback.
    if (explicitAddress) {
      try {
        const streetOnly = extractStreetOnly(explicitAddress);

        const result = await recommendSimilarListings({
          address: streetOnly,
          city: explicitCity ?? undefined,
          fallbackListingId,
          topK: 5,
        });

        updateSession(userId, {
          lastResults: result.recommendations.map((item) => item.listing),
          updatedAt: Date.now(),
        });

        return result;
      } catch (fallbackError) {
        console.error("Week 7 address fallback failed:", fallbackError);
      }
    }

    // If the exact ID failed, use the last active search result.
    if (explicitListingId && session.lastResults.length > 0) {
      try {
        const fallback = session.lastResults[0];
        const result = await recommendSimilarListings({
          fallbackListingId: fallback.L_ListingID,
          topK: 5,
        });

        updateSession(userId, {
          lastResults: result.recommendations.map((item) => item.listing),
          updatedAt: Date.now(),
        });

        return result;
      } catch (fallbackError) {
        console.error("Week 7 listing fallback failed:", fallbackError);
      }
    }

    return {
      response:
        "I could not build recommendations from that request. Try the exact active listing ID, or run a search first and then ask for similar homes.",
      target: null,
      recommendations: [],
    };
  }
}