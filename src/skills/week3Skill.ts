import { searchActiveListings, getSoldComps } from "../services/listings";
import { formatSearchResults, formatSoldCompCard } from "../services/format";
import type { PropertyFilters } from "../types/propertyFilters";

export async function handleWeek3Search(input: {
    filters: PropertyFilters;
    page?: number;
    limit?: number;
}) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 10;

    const result = await searchActiveListings(
        input.filters,
        page,
        limit
    );

    let response = formatSearchResults(
        result.listings,
        result.page,
        result.totalHint
    );

    if (input.filters.city) {
        const comps = await getSoldComps(input.filters.city);

        if (comps.length) {
            response +=
                "\n\nRecent Sold Comps\n\n" +
                comps
                    .slice(0, 5)
                    .map(formatSoldCompCard)
                    .join("\n\n");
        }
    }

    return {
        ...result,
        response
    };
}