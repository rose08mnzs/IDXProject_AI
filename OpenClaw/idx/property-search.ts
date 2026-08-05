import { parsePropertyQuery } from "../../../IDXProject_AI/src/parser/propertyParser";
import { handleWeek3Search } from "../../../IDXProject_AI/src/skills/week3Skill";
import { handleWeek4Conversation } from "../../../IDXProject_AI/src/skills/week4Skill";
import { getSession,updateSession,resetSession,clearMarketSession } from "../../../IDXProject_AI/src/session/sessionManager";
import { week5Skill } from "../../../IDXProject_AI/src/skills/week5Skill";
//import { week6Skill } from "../../../IDXProject_AI/src/skills/week6Skill";
import { week7Skill } from "../../../IDXProject_AI/src/skills/week7Skill";

function looksLikeSemanticQuery(text: string): boolean {
  const semanticWords =
    /\b(charming|cozy|luxury|modern|updated|renovated|character|craftsman|mid-century|light-filled|bright|airy|spacious|elegant|stylish|private|serene|unique|dream home|open concept|open floor plan|quiet|peaceful|tree[-\s]?lined|neighborhood|natural light|mountain views?|ocean views?|beach|resort|retreat|entertaining|backyard|starter home|low maintenance|investment|fixer upper|villa|turnkey)\b/i;

  // Keep this simple. Do NOT block on "in a ..." because phrases like
  // "in a tree-lined neighborhood" are common semantic queries.
  const structuredSignals =
    /(\d+\s*(?:bed|bath|br|bd)|\bunder\b|\$\d|hoa|max\s*hoa|sqft|square feet|\bpool\b|\bview\b)/i;

  return semanticWords.test(text) /*&& !structuredSignals.test(text)*/;
}
function isMarketQuery(text: string): boolean {
  return /\b(market|analytics|trend|trends|days on market|dom|price per sqft|list-to-close|good time to buy|market stats?)\b/i.test(
    text
  );
}
function looksLikeRecommendationQuery(text: string): boolean {
  return /\b(similar|recommend(?:ation)?|comparable|compare|comp[s]?|what else like this|other like this|closest match|best match|like|alternatives?)\b/i.test(
    text
  );
}

function looksLikePropertySearch(text: string): boolean {
  return /(bed(room)?|bath|condo|house|townhome|single family|home|property|price|under|\$|\d+\s*br|pool|view|budget)/i.test(text);
}

function hasActiveConversation(userId: string) {
    return getSession(userId).awaiting !== null;
}

function hasActiveMarketConversation(userId: string) {
  return getSession(userId).marketAwaiting !== null;
}

function isResetCommand(text: string) {
  const lower = text.trim().toLowerCase();
  return lower === "reset" || lower === "start over" || lower === "/reset";
}
function isResetMarketCommand(text: string) {
  const lower = text.trim().toLowerCase();
  return lower === "resetmarket" || lower === "start over market" || lower === "/resetm";
}
function hasStructuredFilters(
  parsed: Awaited<ReturnType<typeof parsePropertyQuery>>
): boolean {
  return Boolean(
    parsed.city ||
      parsed.maxPrice ||
      parsed.beds ||
      parsed.baths ||
      parsed.sqft ||
      parsed.maxHoa
  );
}
export function isAssistantGeneratedText(text: string): boolean {
  const t = text.trim().toLowerCase();

  return (
    t.startsWith("📊 market report") ||
    t.startsWith("here are your top matches") ||
    t.startsWith("which city, zip code, or property type should i analyze?") ||
    t.startsWith("which city are you interested in?") ||
    t.startsWith("what is your maximum budget?") ||
    t.startsWith("how many bedrooms do you need?") ||
    t.startsWith("how many bathrooms do you need?") ||
    t.startsWith("do you prefer single family, condo, townhome") ||

    // NEW
    t.startsWith("i'm ready to assist with your real estate analysis")||
    t.startsWith("conversation cleared.")||
    t.startsWith("market analysis cleared")||
    t.startsWith("i could not find matching") ||
    t.startsWith("i'm sorry") ||
    t.startsWith("i'm here") ||
    t.startsWith("i could not build") ||
    t.startsWith("i could not find enough sold comps") ||
    t.startsWith("top matches for") ||
    t.startsWith("for any real-estate or mls request, call idx_property_search directly.")
  );
}
export async function tryPropertySearch(
    message: string,
    userId = "whatsapp-user"
) {try {
   //const cleanMessage =
    //message.match(/\(self\):\s*(.*)$/s)?.[1]?.trim() ??
    //message.trim();
    
    const cleanMessage = message.trim();

    console.log("RAW:", message);
    console.log("CLEAN:", cleanMessage);
    const lower = cleanMessage.toLowerCase();
    
    if (isResetCommand(cleanMessage)) {
        console.log("Resetting session for user:", userId);
        resetSession(userId);
        //updateSession(userId, {
       //     awaiting: "city"
        //});
        return "Conversation cleared.";
    }
    if (isResetMarketCommand(cleanMessage)) {
        console.log("Resetting Market session for user:", userId);
        clearMarketSession(userId);
        updateSession(userId, {
            marketAwaiting: "city",
        });
        return "Market analysis cleared. Which city should I analyze?";
    }
    if (isAssistantGeneratedText(cleanMessage)) {
        return null;
    }
    if (isMarketQuery(cleanMessage) || hasActiveMarketConversation(userId)) {
        const result = await week5Skill(userId, cleanMessage);
        return result.response;
    }
    //const parsed = await parsePropertyQuery(cleanMessage);
    //const structured = hasStructuredFilters(parsed);
    // const hasSearchConstraints =
    //     parsed.city ||
    //     parsed.maxPrice ||
    //     parsed.beds ||
    //     parsed.baths ||
    //     parsed.sqft ||
    //     parsed.maxHoa;
    //const hasSearchConstraints = hasStructuredFilters(parsed);
    //const semantic = looksLikeSemanticQuery(cleanMessage);

    // if (semantic && !hasSearchConstraints) {
    //     const result = await week6Skill(userId, cleanMessage);
    //     return result.response;
    // }
    if (looksLikeRecommendationQuery(cleanMessage)) {
      const result = await week7Skill(userId, cleanMessage);
      return result.response;
    }
    const semantic = looksLikeSemanticQuery(cleanMessage);
    const property = looksLikePropertySearch(cleanMessage);
    if (!semantic && !property && !hasActiveConversation(userId)){
        return null;
    }
    
    console.log("Routing to Week 4 conversation...");
    const result = await handleWeek4Conversation(userId, cleanMessage);
    console.log("Week 4 result:", result);
    return result;
} catch (error) {
    console.error("Inbound error:", error);

    if (error instanceof AggregateError) {
        console.error("AggregateError details:");
        for (const err of error.errors) {
            console.error(err);
        }
    }

    throw error;
}
}