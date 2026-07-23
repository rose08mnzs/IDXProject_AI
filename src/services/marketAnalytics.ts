import { query } from "../../config/db";
import type {
  InventorySnapshot,
  MarketFilters,
  MarketReport,
  MarketSummary,
  MonthlyTrendRow,
} from "../types/marketAnalytics";

type SoldSummaryRow = {
  sold_count: number | string;
  avg_close_price: number | string | null;
  avg_price_per_sqft: number | string | null;
  avg_dom: number | string | null;
  list_to_close_pct: number | string | null;
};

type MedianRow = {
  median_close_price: number | string | null;
};

type TrendRow = {
  month: string;
  sales: number | string;
  avg_close_price: number | string | null;
  avg_price_per_sqft: number | string | null;
  avg_dom: number | string | null;
};

type ActiveCountRow = {
  active_count: number | string;
};

type SoldCountRow = {
  sold_count: number | string;
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function round1(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.round(value * 10) / 10;
}

function buildLocationLabel(filters: MarketFilters): string {
  const parts: string[] = [];

  if (filters.city) {
    parts.push(filters.city);
  }
  if (filters.zip) {
    parts.push(`ZIP ${filters.zip}`);
  }
  if (filters.propertyType) {
    parts.push(filters.propertyType);
  }
  return parts.length > 0 ? parts.join(" • ") : "California market";
}

function buildSoldWhereClauses(filters: MarketFilters) {
  const clauses: string[] = [
    "PropertyType = 'Residential'",
    "CloseDate >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)",
    "LivingArea > 0",
  ];
  const params: Array<string | number> = [filters.months];

  if (filters.city) {
    clauses.push("City = ?");
    params.push(filters.city);
  }

  if (filters.zip) {
    clauses.push("PostalCode = ?");
    params.push(filters.zip);
  }

  if (filters.propertyType) {
    clauses.push("(PropertySubType = ? OR PropertySubType LIKE ?)");
    params.push(filters.propertyType, `%${filters.propertyType}%`);
  }

  return { clauses, params };
}

function buildActiveWhereClauses(filters: MarketFilters) {
  const clauses: string[] = ["L_Status = 'Active'"];
  const params: Array<string | number> = [];

  if (filters.city) {
    clauses.push("L_City = ?");
    params.push(filters.city);
  }

  if (filters.zip) {
    clauses.push("L_Zip = ?");
    params.push(filters.zip);
  }

  if (filters.propertyType) {
    clauses.push("(L_Type_ = ? OR L_Type_ LIKE ?)");
    params.push(filters.propertyType, `%${filters.propertyType}%`);
  }

  return { clauses, params };
}

async function getMedianClosePrice(filters: MarketFilters): Promise<number | null> {
  const { clauses, params } = buildSoldWhereClauses(filters);

  const sql = `
    WITH ranked AS (
      SELECT
        ClosePrice,
        ROW_NUMBER() OVER (ORDER BY ClosePrice) AS rn,
        COUNT(*) OVER () AS cnt
      FROM california_sold
      WHERE ${clauses.join(" AND ")}
    )
    SELECT ROUND(AVG(ClosePrice), 0) AS median_close_price
    FROM ranked
    WHERE rn IN (FLOOR((cnt + 1) / 2), FLOOR((cnt + 2) / 2))
  `;

  const rows = await query<MedianRow>(sql, params);
  return toNumber(rows[0]?.median_close_price);
}

async function getSoldSummary(filters: MarketFilters): Promise<MarketSummary | null> {
  const { clauses, params } = buildSoldWhereClauses(filters);

  const sql = `
    SELECT
      COUNT(*) AS sold_count,
      ROUND(AVG(ClosePrice), 0) AS avg_close_price,
      ROUND(AVG(ClosePrice / NULLIF(LivingArea, 0)), 0) AS avg_price_per_sqft,
      ROUND(AVG(DaysOnMarket), 1) AS avg_dom,
      ROUND(AVG(ClosePrice / NULLIF(ListPrice, 0)) * 100, 1) AS list_to_close_pct
    FROM california_sold
    WHERE ${clauses.join(" AND ")}
  `;

  const rows = await query<SoldSummaryRow>(sql, params);
  const row = rows[0];

  const soldCount = toNumber(row?.sold_count) ?? 0;
  if (!row || soldCount === 0) {
    return null;
  }

  return {
    locationLabel: buildLocationLabel(filters),
    soldCount,
    avgClosePrice: toNumber(row.avg_close_price),
    medianClosePrice: await getMedianClosePrice(filters),
    avgPricePerSqft: toNumber(row.avg_price_per_sqft),
    avgDaysOnMarket: toNumber(row.avg_dom),
    listToClosePct: toNumber(row.list_to_close_pct),
  };
}

async function getMonthlyTrend(filters: MarketFilters): Promise<MonthlyTrendRow[]> {
  const { clauses, params } = buildSoldWhereClauses(filters);

  const sql = `
    SELECT
      DATE_FORMAT(CloseDate, '%Y-%m') AS month,
      COUNT(*) AS sales,
      ROUND(AVG(ClosePrice), 0) AS avg_close_price,
      ROUND(AVG(ClosePrice / NULLIF(LivingArea, 0)), 0) AS avg_price_per_sqft,
      ROUND(AVG(DaysOnMarket), 1) AS avg_dom
    FROM california_sold
    WHERE ${clauses.join(" AND ")}
    GROUP BY DATE_FORMAT(CloseDate, '%Y-%m')
    ORDER BY month
  `;

  const rows = await query<TrendRow>(sql, params);
  console.log("Months returned:", rows.length);
  console.log(rows.map(r => r.month));
  return rows.map((row, index) => {
    const previous = rows[index - 1];
    const yearAgo = rows[index - 12];

    const currentAvgClose = toNumber(row.avg_close_price);
    const prevAvgClose = toNumber(previous?.avg_close_price);
    const yearAgoAvgClose = toNumber(yearAgo?.avg_close_price);

    const momPriceChangePct =
      currentAvgClose !== null && prevAvgClose !== null && prevAvgClose !== 0
        ? round1(((currentAvgClose - prevAvgClose) / prevAvgClose) * 100)
        : null;

    const yoyPriceChangePct =
      currentAvgClose !== null && yearAgoAvgClose !== null && yearAgoAvgClose !== 0
        ? round1(((currentAvgClose - yearAgoAvgClose) / yearAgoAvgClose) * 100)
        : null;

    console.log("Months requested:", filters.months);
    console.log("Rows returned:", rows.length);
    console.table(rows.map(r => ({
      month: r.month,
      avg: r.avg_close_price
    })));
    return {
      month: row.month,
      sales: toNumber(row.sales) ?? 0,
      avgClosePrice: currentAvgClose,
      avgPricePerSqft: toNumber(row.avg_price_per_sqft),
      avgDaysOnMarket: toNumber(row.avg_dom),
      momPriceChangePct,
      yoyPriceChangePct,
    };
  });
}

async function getInventorySnapshot(filters: MarketFilters): Promise<InventorySnapshot> {
  const activeWhere = buildActiveWhereClauses(filters);
  const soldWhere = buildSoldWhereClauses(filters);

  const activeSql = `
    SELECT COUNT(*) AS active_count
    FROM rets_property
    WHERE ${activeWhere.clauses.join(" AND ")}
  `;

  const soldSql = `
    SELECT COUNT(*) AS sold_count
    FROM california_sold
    WHERE ${soldWhere.clauses.join(" AND ")}
  `;

  const [activeRows, soldRows] = await Promise.all([
    query<ActiveCountRow>(activeSql, activeWhere.params),
    query<SoldCountRow>(soldSql, soldWhere.params),
  ]);

  const activeCount = toNumber(activeRows[0]?.active_count) ?? 0;
  const soldCount = toNumber(soldRows[0]?.sold_count) ?? 0;

  return {
    activeCount,
    soldCount,
    activeToSoldRatio: soldCount > 0 ? round1(activeCount / soldCount) : null,
  };
}

function buildNarrative(
  summary: MarketSummary | null,
  trend: MonthlyTrendRow[],
  inventory: InventorySnapshot
): string {
  if (!summary) {
    return "I could not find enough sold comps for that market.";
  }

  const dom = summary.avgDaysOnMarket !== null ? summary.avgDaysOnMarket.toFixed(1) : "n/a";

  const pieces: string[] = [];

  pieces.push(
    `${summary.locationLabel}: ${summary.soldCount.toLocaleString()} sold comps, median close price ${
      summary.medianClosePrice !== null ? `$${summary.medianClosePrice.toLocaleString()}` : "n/a" 
      }, average days on market ${dom} days.`
  );

  if (summary.listToClosePct !== null) {
    pieces.push(`Average list-to-close ratio: ${summary.listToClosePct.toFixed(1)}%.`);
  }

  if (summary.avgPricePerSqft !== null) {
    pieces.push(`Average price per sqft: $${summary.avgPricePerSqft.toLocaleString()}.`);
  }

  if (trend.length > 1) {
    const first = trend[0];
    const last = trend[trend.length - 1];

    if (first.avgClosePrice !== null && last.avgClosePrice !== null && first.avgClosePrice !== 0) {
      const changePct = round1(((last.avgClosePrice - first.avgClosePrice) / first.avgClosePrice) * 100);
      if (changePct !== null) {
        pieces.push(
          `Over the selected period, average close price is ${
            changePct >= 0 ? "up" : "down"
          } ${Math.abs(changePct).toFixed(1)}%.`
        );
      }
    }
  }

  pieces.push(
    `Inventory comparison: ${inventory.activeCount.toLocaleString()} active listings vs ${inventory.soldCount.toLocaleString()} sold comps${
      inventory.activeToSoldRatio !== null
        ? ` (ratio ${inventory.activeToSoldRatio.toFixed(1)}).`
        : "."
    }`
  );

  return pieces.join(" ");
}

export async function buildMarketReport(filters: MarketFilters): Promise<MarketReport> {
  const [summary, trend, inventory] = await Promise.all([
    getSoldSummary(filters),
    getMonthlyTrend(filters),
    getInventorySnapshot(filters),
  ]);

  return {
    filters,
    summary,
    trend,
    inventory,
    narrative: buildNarrative(summary, trend, inventory),
  };
}