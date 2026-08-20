import { getSession, resetSession, clearMarketSession, updateSession } from "../../../IDXProject_AI/src/session/sessionManager";
import { onWhatsAppMessage,} from "../../../IDXProject_AI/src/services/whatsapp";

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
    t.startsWith("📚 rag answer") ||
    t.startsWith("for any real-estate or mls request, call idx_property_search directly.")
  );
}
function isResetCommand(text: string) {
  const lower = text.trim().toLowerCase();
  return lower === "reset" || lower === "start over" || lower === "/reset";
}
function isResetMarketCommand(text: string) {
  const lower = text.trim().toLowerCase();
  return lower === "resetmarket" || lower === "start over market" || lower === "/resetm";
}

export async function tryPropertySearch(
  message: string,
  userId = "whatsapp-user"
) {
  try {
    const cleanMessage = message.trim();

    console.log("RAW:", message);
    console.log("CLEAN:", cleanMessage);

    if (!cleanMessage) {
      return null;
    }

    // Keep reset handling at the channel-entry layer.
    if (isResetCommand(cleanMessage)) {
      console.log(
        "Resetting session for user:",
        userId
      );

      resetSession(userId);

      return "Conversation cleared.";
    }

    if (isResetMarketCommand(cleanMessage)) {
      console.log(
        "Resetting market session for user:",
        userId
      );

      clearMarketSession(userId);

      updateSession(userId, {
        marketAwaiting: "city",
      });

      return "Market analysis cleared. Which city should I analyze?";
    }

    // Prevent the assistant's own replies from being
    // routed back through the agent system.
    if (isAssistantGeneratedText(cleanMessage)) {
      return null;
    }

    console.log("Routing WhatsApp message through Week 10...");

    return await onWhatsAppMessage(
      cleanMessage,
      userId
    );
  } catch (error) {
    console.error(
      "Inbound WhatsApp orchestration error:",
      error
    );

    if (error instanceof AggregateError) {
      console.error(
        "AggregateError details:"
      );

      for (const err of error.errors) {
        console.error(err);
      }
    }

    throw error;
  }
}