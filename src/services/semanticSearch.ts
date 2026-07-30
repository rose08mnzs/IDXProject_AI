import { query } from "../../config/db";
import { parsePropertyQuery } from "../parser/propertyParser";
import { cosineSimilarity, getEmbedding, getEmbeddings } from "./embeddings";
import type { PropertyFilters, ListingRow  } from "../types/propertyFilters";

type SemanticCandidateRow = {
  L_ListingID: string;
  L_Address: string | null;
  L_City: string | null;
  L_Zip: string | null;
  L_SystemPrice: number | null;
  L_Keyword2: number | null;
  LM_Dec_3: number | null;
  LM_Int2_3: number | null;
  L_Type_: string | null;
  L_Remarks: string | null;
  YearBuilt: number | null;
  L_Status: string | null;
  ModificationTimestamp: string | null;
};

type EmbeddingCacheRow = {
  listing_id: string;
  embedding_json: string;
  source_text: string;
};

export interface SemanticMatch {
  listingId: string;
  score: number;
  address: string;
  city: string;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  type: string | null;
  remarks: string | null;
}

function hasStructuredFilters(filters: PropertyFilters): boolean {
  return Boolean(
      filters.city ||
      filters.zip ||
      filters.maxPrice ||
      filters.beds ||
      filters.baths ||
      filters.sqft ||
      filters.type ||
      filters.pool ||
      filters.hasView ||
      filters.maxHoa
  );
}

function buildWhereClause(filters: PropertyFilters) {
  let sql = ` WHERE L_Status = "Active" `;
  const params: Array<string | number> = [];

  if (filters.city) {
    sql += " AND LOWER(L_City)=LOWER(?) ";
    params.push(filters.city);
  }
  if (filters.zip) {
    sql += " AND L_Zip = ? ";
    params.push(filters.zip);
  }
  if (filters.maxPrice) {
    sql += " AND L_SystemPrice <= ? ";
    params.push(filters.maxPrice);
  }
  if (filters.beds) {
    sql += " AND L_Keyword2 >= ? ";
    params.push(filters.beds);
  }
  if (filters.baths) {
    sql += " AND LM_Dec_3 >= ? ";
    params.push(filters.baths);
  }
  if (filters.sqft) {
    sql += " AND LM_Int2_3 >= ? ";
    params.push(filters.sqft);
  }
  if (filters.type) {
    sql += " AND L_Type_ = ? ";
    params.push(filters.type);
  }
  if (filters.pool) {
    sql += " AND PoolPrivateYN = ? ";
    params.push(filters.pool);
  }
  if (filters.hasView) {
    sql += " AND ViewYN = ? ";
    params.push(filters.hasView);
  }
  if (filters.maxHoa) {
    sql += " AND (AssociationFee IS NULL OR AssociationFee <= ?) ";
    params.push(filters.maxHoa);
  }

  return { sql, params };
}

function buildListingText(row: SemanticCandidateRow): string {
  return [
    `${row.L_Type_ ?? "Property"} in ${row.L_City ?? "Unknown city"}, CA`,
    row.L_Address ? `Address: ${row.L_Address}` : null,
    row.L_Keyword2 !== null ? `${row.L_Keyword2} beds` : null,
    row.LM_Dec_3 !== null ? `${row.LM_Dec_3} baths` : null,
    row.LM_Int2_3 !== null ? `${row.LM_Int2_3} sqft` : null,
    row.YearBuilt !== null ? `Built ${row.YearBuilt}` : null,
    row.L_SystemPrice !== null ? `Price $${row.L_SystemPrice.toLocaleString()}` : null,
    row.L_Remarks ?? null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(". ");
}

async function fetchCandidates(queryText: string, candidateLimit: number) {
  const filters = await parsePropertyQuery(queryText);
  const structured = hasStructuredFilters(filters);

  let sql = `
    SELECT
      L_ListingID, L_Address, L_City, L_Zip, L_SystemPrice,
      L_Keyword2, LM_Dec_3, LM_Int2_3, L_Type_, L_Remarks,
      YearBuilt, L_Status, ModificationTimestamp
    FROM rets_property
  `;

  const params: Array<string | number> = [];
  if (structured) {
    const where = buildWhereClause(filters);
    sql += where.sql;
    params.push(...where.params);
    sql += " ORDER BY L_SystemPrice ASC ";
  } else {
    sql += ` WHERE L_Status = "Active" `;
    sql += " ORDER BY ModificationTimestamp DESC ";
  }

  sql += " LIMIT ? ";
  params.push(candidateLimit);

  const rows = await query<SemanticCandidateRow>(sql, params);
  return { filters, rows };
}

async function loadCachedEmbeddings(ids: string[]): Promise<Map<string, number[]>> {
  const cache = new Map<string, number[]>();
  if (ids.length === 0) return cache;

  const placeholders = ids.map(() => "?").join(",");
  const rows = await query<EmbeddingCacheRow>(
    `SELECT listing_id, embedding_json, source_text FROM listing_embeddings WHERE listing_id IN (${placeholders})`,
    ids
  );

  for (const row of rows) {
    try {
      cache.set(row.listing_id, JSON.parse(row.embedding_json) as number[]);
    } catch {
      // ignore malformed cache rows and rebuild them on demand
    }
  }

  return cache;
}

async function upsertEmbedding(
  listingId: string,
  sourceText: string,
  embedding: number[]
): Promise<void> {
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

function buildMatchFromRow(row: SemanticCandidateRow, score: number): SemanticMatch {
  return {
    listingId: row.L_ListingID,
    score: Number(score.toFixed(4)),
    address: row.L_Address ?? "Unknown address",
    city: row.L_City ?? "Unknown city",
    price: row.L_SystemPrice ?? null,
    beds: row.L_Keyword2 ?? null,
    baths: row.LM_Dec_3 ?? null,
    sqft: row.LM_Int2_3 ?? null,
    type: row.L_Type_ ?? null,
    remarks: row.L_Remarks ?? null,
  };
}

export async function semanticPropertySearch(
  queryText: string,
  topK = 5,
  candidateLimit = 200
): Promise<SemanticMatch[]> {
  const { rows } = await fetchCandidates(queryText, candidateLimit);
  if (!rows.length) return [];

  const ids = rows.map((row) => row.L_ListingID);
  const cache = await loadCachedEmbeddings(ids);

  const missingRows = rows.filter((row) => !cache.has(row.L_ListingID));
  if (missingRows.length > 0) {
    const missingTexts = missingRows.map(buildListingText);
    const missingEmbeddings = await getEmbeddings(missingTexts);

    for (let i = 0; i < missingRows.length; i++) {
      const row = missingRows[i];
      const embedding = missingEmbeddings[i];
      cache.set(row.L_ListingID, embedding);
      await upsertEmbedding(row.L_ListingID, buildListingText(row), embedding);
    }
  }

  const queryEmbedding = await getEmbedding(queryText);

  const scored = rows
    .map((row) => {
      const embedding = cache.get(row.L_ListingID);
      if (!embedding) return null;
      return {
        row,
        score: cosineSimilarity(queryEmbedding, embedding),
      };
    })
    .filter((item): item is { row: SemanticCandidateRow; score: number } => Boolean(item))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map(({ row, score }) => buildMatchFromRow(row, score));
}
function listingToSemanticText(listing: ListingRow): string {
  return [
    listing.type ?? "",
    listing.L_City ?? "",
    listing.L_Address ?? "",
    listing.L_Remarks ?? "",
    `beds ${listing.beds ?? "unknown"}`,
    `baths ${listing.baths ?? "unknown"}`,
    `sqft ${listing.sqft ?? "unknown"}`,
    `price ${listing.price ?? "unknown"}`,
    listing.AssociationFee ? `hoa ${listing.AssociationFee}` : "",
  ]
    .filter(Boolean)
    .join(". ");
}

export async function rerankListings(
  listings: ListingRow[],
  semanticHint: string | null
): Promise<Array<ListingRow & { score?: number }>>{
  if (!semanticHint || listings.length === 0) return listings;

  const hintEmbedding = await getEmbedding(semanticHint);

  const ranked = await Promise.all(
    listings.map(async (listing) => {
      const listingEmbedding = await getEmbedding(listingToSemanticText(listing));
      return {
          ...listing,
          score: cosineSimilarity(hintEmbedding, listingEmbedding),
      };
    })
  );

  ranked.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return ranked;
}