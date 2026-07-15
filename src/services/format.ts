import type { ListingRow, SoldRow } from "../types/propertyFilters";

export function formatListingCard(listing: ListingRow): string {
  const address = listing.L_Address ?? "Unknown address";
  const city = listing.L_City ?? "";
  const price = listing.price ? `$${listing.price.toLocaleString()}` : "N/A";
  const beds = listing.beds ?? "N/A";
  const baths = listing.baths ?? "N/A";
  const sqft = listing.sqft ? `${listing.sqft.toLocaleString()} sqft` : "N/A";
  const hoa = listing.AssociationFee ? `$${listing.AssociationFee}/mo HOA` : "No HOA data";
  const dom = listing.DaysOnMarket ?? "N/A";
  const photos = listing.PhotoCount ?? 0;

  return [
    `🏠 ${address}${city ? `, ${city}` : ""}`,
    `💰 ${price} | 🛏 ${beds} bd | 🛁 ${baths} ba | 📐 ${sqft}`,
    `🏡 ${hoa} | 📅 ${dom} DOM | 📷 ${photos} photos`,
  ].join("\n");
}

export function formatSearchResults(listings: ListingRow[], page: number, totalHint: number): string {
  if (!listings.length) return "No matching listings found.";

  const cards = listings.map(formatListingCard).join("\n\n");
  return `Page ${page} • ${totalHint}+ matches\n\n${cards}`;
}

export function formatSoldCompCard(comp: SoldRow): string {
  const address = comp.UnparsedAddress ?? "Unknown address";
  const price = comp.ClosePrice ? `$${comp.ClosePrice.toLocaleString()}` : "N/A";
  const livingArea = comp.LivingArea ? `${Math.round(comp.LivingArea).toLocaleString()} sqft` : "N/A";
  const dom = comp.DaysOnMarket ?? "N/A";

  return [
    `📈 ${address}`,
    `💰 Sold ${price} | 📐 ${livingArea} | 📅 ${dom} DOM`,
    `🏘 ${comp.City ?? "Unknown city"} | ${comp.PropertySubType ?? comp.PropertyType ?? "Residential"}`,
  ].join("\n");
}