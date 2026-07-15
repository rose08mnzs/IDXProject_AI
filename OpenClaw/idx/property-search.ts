import { parsePropertyQuery } from "../../../IDXProject_AI/src/parser/propertyParser";
import { handleWeek3Search } from "../../../IDXProject_AI/src/skills/week3Skill";

function looksLikePropertySearch(text: string) {
    return /(bed(room)?|bath|condo|house|townhome|irvine|price|under|\$|\d+\s*br)/i.test(text);
}

export async function tryPropertySearch(message: string) {
    if (!looksLikePropertySearch(message))
        return null;

    const filters = await parsePropertyQuery(message);

    const result = await handleWeek3Search({
        filters,
        page: 1,
        limit: 5
    });

    return result.response;
}