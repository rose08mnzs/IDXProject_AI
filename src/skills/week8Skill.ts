import { answerWeek8Question, formatWeek8Response } from "../services/rag";

function extractUserText(message: string): string {
  const wrapped = message.match(/\):\s*(.*)$/s);
  return (wrapped?.[1] ?? message).trim();
}

export async function week8Skill(userId: string, message: string) {
  const userText = extractUserText(message);

  if (/^(reset|\/reset|start over)$/i.test(userText.trim())) {
    return {
      response: "RAG context cleared. Ask me about DOM, comps, schema columns, or real-estate terms.",
      answer: null,
      userId,
    };
  }

  const answer = await answerWeek8Question(userText);

  return {
    response: formatWeek8Response(answer),
    answer,
    userId,
  };
}