import { parsePropertyQuery } from "../../../IDXProject_AI/src/parser/propertyParser";
import { handleWeek3Search } from "../../../IDXProject_AI/src/skills/week3Skill";
import { handleWeek4Conversation } from "../../../IDXProject_AI/src/skills/week4Skill";
import { getSession,updateSession,resetSession } from "../../../IDXProject_AI/src/session/sessionManager";
function looksLikePropertySearch(text: string) {
    return /(bed(room)?|bath|condo|house|townhome|single family|home|property|irvine|price|under|\$|\d+\s*br|pool|view|budget)/i.test(text);
}

// export async function tryPropertySearch(message: string) {
//     if (!looksLikePropertySearch(message))
//         return null;

//     const filters = await parsePropertyQuery(message);

//     const result = await handleWeek3Search({
//         filters,
//         page: 1,
//         limit: 5
//     });

//     return result.response;
// }
function hasActiveConversation(userId: string) {
    return getSession(userId).awaiting !== null;
}
function isResetCommand(text: string) {
    const lower = text.trim().toLowerCase();
    return lower === "reset" || lower === "start over";
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

    if (!looksLikePropertySearch(cleanMessage) &&
        !hasActiveConversation(userId))
        return null;

    return await handleWeek4Conversation(userId, cleanMessage);
}