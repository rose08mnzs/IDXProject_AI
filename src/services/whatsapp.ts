import { orchestrate } from "./orchestrator";
import type { OrchestrationResult } from "../agents/types";

/**
 * Week 10 WhatsApp response formatter.
 *
 * The agents already return WhatsApp-friendly text.
 * This layer gives us one consistent entry point for
 * converting an orchestration result into a WhatsApp message.
 */
export function formatForWhatsApp(
  result: OrchestrationResult
): string {
  if (!result) {
    return "Sorry, I could not process that request.";
  }

  const response = result.response?.trim();

  if (response) {
    return response;
  }

  return "No results found.";
}

/**
 * Week 10 WhatsApp message handler.
 *
 * OpenClaw/WhatsApp passes the incoming text and user ID here.
 * The Week 9 orchestrator handles routing to the correct agents.
 */
export async function onWhatsAppMessage(
  message: string,
  userId: string
): Promise<string> {
  const cleanMessage = message.trim();

  if (!cleanMessage) {
    return "Please send a property, market, recommendation, or real-estate question.";
  }

  try {
    const result = await orchestrate(
      cleanMessage,
      userId
    );

    return formatForWhatsApp(result);
  } catch (error) {
    console.error(
      "WhatsApp orchestration error:",
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

    return "Sorry, I hit an issue while processing your request. Please try again.";
  }
}