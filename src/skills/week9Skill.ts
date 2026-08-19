import {
  orchestrate,
} from "../services/orchestrator";

export async function week9Skill(
  userId: string,
  message: string
) {
  try {
    const result =
      await orchestrate(
        message,
        userId
      );

    return result;
  } catch (error) {
    console.error(
      "Week 9 orchestration failed:",
      error
    );

    return {
      intent: "unknown" as const,
      agents: [],
      response:
        "Sorry, I could not complete the request because one of the agents failed.",
      results: [],
      metadata: {
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
    };
  }
}