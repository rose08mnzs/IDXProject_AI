// src/skills/propertySearchSkill.ts
import { parsePropertyQuery } from "../parser/propertyParser";
import { handleWeek3Search } from "./week3Skill";
import { handleWeek4Conversation } from "./week4Skill";

// export async function propertySearchSkill(message: string, page = 1, limit = 10) {
//   const filters = await parsePropertyQuery(message);

//   return handleWeek3Search({
//     filters,
//     page,
//     limit,
//   });
// }

export async function propertySearchSkill(userId: string, message: string): Promise<string> {
  return handleWeek4Conversation(userId, message);
}