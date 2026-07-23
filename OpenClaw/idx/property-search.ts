import { parsePropertyQuery } from "../../../IDXProject_AI/src/parser/propertyParser";
import { handleWeek3Search } from "../../../IDXProject_AI/src/skills/week3Skill";
import { handleWeek4Conversation } from "../../../IDXProject_AI/src/skills/week4Skill";
import { getSession,updateSession,resetSession } from "../../../IDXProject_AI/src/session/sessionManager";
import { week5Skill } from "../../../IDXProject_AI/src/skills/week5Skill";
function looksLikePropertySearch(text: string) {
    return /(bed(room)?|bath|condo|house|townhome|single family|home|property|price|under|\$|\d+\s*br|pool|view|budget)/i.test(text);
}
function isMarketQuery(text: string): boolean {
  return /\b(market|analytics|trend|trends|days on market|dom|price per sqft|list-to-close|good time to buy|market stats?)\b/i.test(
    text
  );
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

function isAssistantGeneratedText(text: string): boolean {
  const t = text.trim().toLowerCase();

  return (
    t.startsWith("📊 market report") ||
    t.startsWith("here are your top matches") ||
    t.startsWith("which city, zip code, or property type should i analyze?") ||
    t.startsWith("which city are you interested in?") ||
    t.startsWith("what is your maximum budget?") ||
    t.startsWith("how many bedrooms do you need?") ||
    t.startsWith("how many bathrooms do you need?") ||
    t.startsWith("do you prefer single family, condo, townhome")
  );
}
export async function tryPropertySearch(
    message: string,
    userId = "whatsapp-user"
) {
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
        updateSession(userId, {
            awaiting: "city"
        });
        return "Conversation cleared. Which city are you interested in?";
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

    if (!looksLikePropertySearch(cleanMessage) && !hasActiveConversation(userId)){
        return null;
    }
    
    return await handleWeek4Conversation(userId, cleanMessage);
}