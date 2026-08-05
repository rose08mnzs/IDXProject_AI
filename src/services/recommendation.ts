import { query } from "../../config/db";
import {
  cosineSimilarity,
  getEmbedding,
  getEmbeddings,
} from "./embeddings";
import { formatListingCard } from "./format";
import type { ListingRow } from "../types/propertyFilters";

type ListingWithRemarks = {
  L_ListingID: string;
  L_DisplayId: string | null;
  L_Address: string | null;
  L_City: string | null;
  L_Zip: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  type: string | null;
  status: string | null;
  lat: number | null;
  lng: number | null;
  YearBuilt: number | null;
  AssociationFee: number | null;
  DaysOnMarket: number | null;
  PoolPrivateYN: string | null;
  ViewYN: string | null;
  FireplaceYN: string | null;
  PhotoCount: number | null;
  LA1_UserFirstName: string | null;
  LA1_UserLastName: string | null;
  LO1_OrganizationName: string | null;
  L_Remarks: string | null;
};

type SoldCompAggRow = {
  avg_ppsf: number | string | null;
  comp_count: number | string;
};

type EmbeddingCacheRow = {
  listing_id: string;
  embedding_json: string;
  source_text: string;
};

export interface RecommendationInput {
  listingId?: string;
  address?: string;
  city?: string;
  zip?: string;
  fallbackListingId?: string;
  topK?: number;
}

export interface RecommendationItem {
  listing: ListingWithRemarks;
  totalScore: number;
  structuredScore: number;
  semanticScore: number;
  compCheck: {
    comp_price: number;
    list_price: number;
    comp_count: number;
    delta_pct: number | null;
  };
}

export interface RecommendationResult {
  target: ListingWithRemarks;
  recommendations: RecommendationItem[];
  targetCompCheck: {
    comp_price: number;
    list_price: number;
    comp_count: number;
    delta_pct: number | null;
  };
  response: string;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function formatMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function formatAddress(row: Pick<ListingWithRemarks, "L_Address" | "L_City" | "L_Zip">): string {
  const address = row.L_Address?.trim();
  const city = row.L_City?.trim();
  const zip = row.L_Zip?.trim();

  if (address && city && zip) {
    return `${address}, ${city} (${zip})`;
  }

  if (address && city) {
    return `${address}, ${city}`;
  }

  if (city) {
    return city;
  }

  if (address) {
    return address;
  }

  return "Address unavailable";
}

function buildListingText(row: ListingWithRemarks): string {
  return [
    `${row.type ?? "Property"} in ${row.L_City ?? "Unknown city"}, CA`,
    row.L_Address ? `Address: ${row.L_Address}` : null,
    row.beds !== null ? `${row.beds} beds` : null,
    row.baths !== null ? `${row.baths} baths` : null,
    row.sqft !== null ? `${row.sqft} sqft` : null,
    row.YearBuilt !== null ? `Built ${row.YearBuilt}` : null,
    row.price !== null ? `Price ${formatMoney(row.price)}` : null,
    row.L_Remarks ?? null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(". ");
}

async function loadCachedEmbeddings(ids: string[]): Promise<Map<string, number[]>> {
  const cache = new Map<string, number[]>();
  if (ids.length === 0) return cache;

  const placeholders = ids.map(() => "?").join(",");
  const rows = await query<EmbeddingCacheRow>(
    `
      SELECT listing_id, embedding_json, source_text
      FROM listing_embeddings
      WHERE listing_id IN (${placeholders})
    `,
    ids
  );

  for (const row of rows) {
    try {
      cache.set(row.listing_id, JSON.parse(row.embedding_json) as number[]);
    } catch {
      // Ignore malformed cache rows.
    }
  }

  return cache;
}

async function upsertEmbedding(listingId: string, sourceText: string, embedding: number[]) {
  await query(
    `
      INSERT INTO listing_embeddings (listing_id, embedding_json, source_text)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        embedding_json = VALUES(embedding_json),
        source_text = VALUES(source_text),
        updated_at = CURRENT_TIMESTAMP
    `,
    [listingId, JSON.stringify(embedding), sourceText]
  );
}

async function getOrCreateEmbeddings(rows: ListingWithRemarks[]): Promise<Map<string, number[]>> {
  const ids = rows.map((r) => r.L_ListingID);
  const cache = await loadCachedEmbeddings(ids);

  const missing = rows.filter((r) => !cache.has(r.L_ListingID));
  if (missing.length > 0) {
    const texts = missing.map(buildListingText);
    const embeddings = await getEmbeddings(texts);

    for (let i = 0; i < missing.length; i++) {
      const row = missing[i];
      const emb = embeddings[i];
      cache.set(row.L_ListingID, emb);
      await upsertEmbedding(row.L_ListingID, buildListingText(row), emb);
    }
  }

  return cache;
}

function calculateStructuredScore(target: ListingWithRemarks, candidate: ListingWithRemarks): number {
  let score = 0;

  const targetPrice = target.price ?? 0;
  const candidatePrice = candidate.price ?? 0;
  const priceDiff = Math.abs(targetPrice - candidatePrice);

  if (priceDiff < 50_000) score += 20;
  else if (priceDiff < 150_000) score += 12;
  else if (priceDiff < 300_000) score += 5;

  if (target.beds !== null && candidate.beds !== null && target.beds === candidate.beds) score += 15;

  if (
    normalizeText(target.L_City).toLowerCase() &&
    normalizeText(target.L_City).toLowerCase() === normalizeText(candidate.L_City).toLowerCase()
  ) {
    score += 15;
  }

  const targetSqft = target.sqft ?? 0;
  const candidateSqft = candidate.sqft ?? 0;
  const sqftDiff = Math.abs(targetSqft - candidateSqft);

  if (sqftDiff < 300) score += 10;
  else if (sqftDiff < 700) score += 5;

  const targetType = normalizeText(target.type).toLowerCase();
  const candidateType = normalizeText(candidate.type).toLowerCase();
  if (targetType && candidateType && targetType === candidateType) {
    score += 5;
  }

  if (target.PoolPrivateYN && candidate.PoolPrivateYN && target.PoolPrivateYN === candidate.PoolPrivateYN) {
    score += 2;
  }

  if (target.ViewYN && candidate.ViewYN && target.ViewYN === candidate.ViewYN) {
    score += 2;
  }

  return Math.min(score, 60);
}

async function validateWithComps(
  city: string | null,
  sqft: number | null,
  price: number | null
): Promise<{
  comp_price: number;
  list_price: number;
  comp_count: number;
  delta_pct: number | null;
}> {
  if (!city || sqft === null || price === null) {
    return {
      comp_price: 0,
      list_price: price ?? 0,
      comp_count: 0,
      delta_pct: null,
    };
  }

  const rows = await query<SoldCompAggRow>(
    `
      SELECT
        AVG(ClosePrice / NULLIF(LivingArea, 0)) AS avg_ppsf,
        COUNT(*) AS comp_count
      FROM california_sold
      WHERE City = ?
        AND PropertyType = 'Residential'
        AND LivingArea BETWEEN ? AND ?
        AND CloseDate >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    `,
    [city, sqft * 0.8, sqft * 1.2]
  );

  const avgPpsf = toNumber(rows[0]?.avg_ppsf);
  const compCount = toNumber(rows[0]?.comp_count) ?? 0;
  const compPrice = avgPpsf ? Math.round(avgPpsf * sqft) : 0;

  const deltaPct =
    compPrice > 0 && price !== null
      ? Number((((price - compPrice) / compPrice) * 100).toFixed(1))
      : null;

  return {
    comp_price: compPrice,
    list_price: price ?? 0,
    comp_count: compCount,
    delta_pct: deltaPct,
  };
}

async function findTargetListing(input: RecommendationInput): Promise<ListingWithRemarks | null> {
  const selectSql = `
    SELECT
      L_ListingID,
      L_DisplayId,
      L_Address,
      L_City,
      L_Zip,
      L_SystemPrice AS price,
      L_Keyword2 AS beds,
      LM_Dec_3 AS baths,
      LM_Int2_3 AS sqft,
      L_Type_ AS type,
      L_Status AS status,
      LMD_MP_Latitude AS lat,
      LMD_MP_Longitude AS lng,
      YearBuilt,
      AssociationFee,
      DaysOnMarket,
      PoolPrivateYN,
      ViewYN,
      FireplaceYN,
      PhotoCount,
      LA1_UserFirstName,
      LA1_UserLastName,
      LO1_OrganizationName,
      L_Remarks
    FROM rets_property
    WHERE L_Status = 'Active'
  `;

  if (input.listingId) {
    const rows = await query<ListingWithRemarks>(
      `${selectSql}
       AND (CAST(L_ListingID AS CHAR) = ? OR L_DisplayId = ?)
       LIMIT 1`,
      [input.listingId, input.listingId]
    );
    if (rows[0]) return rows[0];
  }

  if (input.address) {
    const rows = await query<ListingWithRemarks>(
      `${selectSql}
       AND LOWER(L_Address) LIKE LOWER(?)
       ORDER BY DaysOnMarket ASC
       LIMIT 1`,
      [`%${input.address}%`]
    );
    if (rows[0]) return rows[0];
  }

  if (input.city) {
    const rows = await query<ListingWithRemarks>(
      `${selectSql}
       AND LOWER(L_City) = LOWER(?)
       ORDER BY DaysOnMarket ASC
       LIMIT 1`,
      [input.city]
    );
    if (rows[0]) return rows[0];
  }
  if (input.zip) {
    const rows = await query<ListingRow>(
      `${selectSql}
      AND L_Zip = ?
      ORDER BY DaysOnMarket ASC
      LIMIT 1`,
      [input.zip]
    );
    if (rows[0]) return rows[0];
  }
  if (input.fallbackListingId) {
    const rows = await query<ListingWithRemarks>(
      `${selectSql}
       AND CAST(L_ListingID AS CHAR) = ?
       LIMIT 1`,
      [input.fallbackListingId]
    );
    if (rows[0]) return rows[0];
  }

  return null;
}

async function getCandidateListings(target: ListingWithRemarks, limit = 40): Promise<ListingWithRemarks[]> {
  const params: Array<string | number> = [target.L_ListingID];

  let sql = `
    SELECT
      L_ListingID,
      L_DisplayId,
      L_Address,
      L_City,
      L_Zip,
      L_SystemPrice AS price,
      L_Keyword2 AS beds,
      LM_Dec_3 AS baths,
      LM_Int2_3 AS sqft,
      L_Type_ AS type,
      L_Status AS status,
      LMD_MP_Latitude AS lat,
      LMD_MP_Longitude AS lng,
      YearBuilt,
      AssociationFee,
      DaysOnMarket,
      PoolPrivateYN,
      ViewYN,
      FireplaceYN,
      PhotoCount,
      LA1_UserFirstName,
      LA1_UserLastName,
      LO1_OrganizationName,
      L_Remarks
    FROM rets_property
    WHERE L_Status = 'Active'
      AND L_ListingID <> ?
  `;

  if (target.L_Zip) {
    sql += ` AND L_Zip = ? `;
    params.push(target.L_Zip);
  } else if (target.L_City) {
    sql += ` AND LOWER(L_City) = LOWER(?) `;
    params.push(target.L_City);
  }

  sql += `
    ORDER BY
      ABS(COALESCE(L_SystemPrice, 0) - COALESCE(?, 0)) ASC,
      DaysOnMarket ASC
    LIMIT ?
  `;

  params.push(target.price ?? 0, limit);

  return query<ListingWithRemarks>(sql, params);
}

function buildResponse(
  target: ListingWithRemarks,
  recommendations: RecommendationItem[],
  targetCompCheck: RecommendationResult["targetCompCheck"]
): string {
  const targetAddress = formatAddress(target);
  let out = `Top matches for: ${targetAddress}\n`;
  out += `Target price: ${formatMoney(target.price)} | Comp estimate: ${formatMoney(targetCompCheck.comp_price)}`;
  if (targetCompCheck.delta_pct !== null) {
    out += `\nMarket Difference: ${targetCompCheck.delta_pct > 0 ? "+" : ""}${targetCompCheck.delta_pct}% vs comps`;
  }
  out += `\nComp count: ${targetCompCheck.comp_count}\n\n`;

  recommendations.forEach((item, idx) => {
    const listing = item.listing;
    out += `${idx + 1}) ${formatListingCard(listing as unknown as ListingRow)}\n`;
    out += `- Score: ${item.totalScore.toFixed(2)} | structured ${item.structuredScore.toFixed(2)} | semantic ${item.semanticScore.toFixed(2)}\n`;
    out += `- Comp estimate: ${formatMoney(item.compCheck.comp_price)} | Market Difference: `;
    out += item.compCheck.delta_pct === null ? "n/a" : `${item.compCheck.delta_pct > 0 ? "+" : ""}${item.compCheck.delta_pct}%`;
    out += `\n`;
    //out += `- DOM: ${listing.DaysOnMarket ?? "n/a"} | Photos: ${listing.PhotoCount ?? "n/a"}\n\n`;
  });

  return out.trim();
}

export async function recommendSimilarListings(
  input: RecommendationInput
): Promise<RecommendationResult> {
  const target = await findTargetListing(input);

  if (!target) {
    throw new Error("Could not find a target active listing. Provide a listing ID, address, or city.");
  }

  const candidates = await getCandidateListings(target, 40);
  const targetEmbeddings = await getOrCreateEmbeddings([target]);
  const targetEmbedding = targetEmbeddings.get(target.L_ListingID);

  if (!targetEmbedding) {
    throw new Error("Could not build an embedding for the target listing.");
  }

  const candidateEmbeddings = await getOrCreateEmbeddings(candidates);

  const scored: RecommendationItem[] = [];
  for (const candidate of candidates) {
    const candEmbedding = candidateEmbeddings.get(candidate.L_ListingID);
    if (!candEmbedding) continue;

    const structuredScore = calculateStructuredScore(target, candidate);
    const semanticScore = cosineSimilarity(targetEmbedding, candEmbedding) * 40;
    const totalScore = Number((structuredScore + semanticScore).toFixed(2));

    const compCheck = await validateWithComps(candidate.L_City, candidate.sqft, candidate.price);

    scored.push({
      listing: candidate,
      totalScore,
      structuredScore,
      semanticScore,
      compCheck,
    });
  }

  scored.sort((a, b) => b.totalScore - a.totalScore);

  const topK = Math.max(1, Math.min(input.topK ?? 5, 10));
  const recommendations = scored.slice(0, topK);
  const targetCompCheck = await validateWithComps(target.L_City, target.sqft, target.price);

  return {
    target,
    recommendations,
    targetCompCheck,
    response: buildResponse(target, recommendations, targetCompCheck),
  };
}