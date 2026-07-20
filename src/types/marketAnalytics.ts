export interface MarketFilters {
  city?: string | null;
  zip?: string | null;
  propertyType?: string | null;
  months?: number;
}

export interface MarketSummary {
  locationLabel: string;
  soldCount: number;
  avgClosePrice: number | null;
  medianClosePrice: number | null;
  avgPricePerSqft: number | null;
  avgDaysOnMarket: number | null;
  listToClosePct: number | null;
}

export interface MonthlyTrendRow {
  month: string; // YYYY-MM
  sales: number;
  avgClosePrice: number | null;
  avgPricePerSqft: number | null;
  avgDaysOnMarket: number | null;
  momPriceChangePct: number | null;
  yoyPriceChangePct: number | null;
}

export interface InventorySnapshot {
  activeCount: number;
  soldCount: number;
  activeToSoldRatio: number | null;
}

export interface MarketReport {
  filters: MarketFilters;
  summary: MarketSummary | null;
  trend: MonthlyTrendRow[];
  inventory: InventorySnapshot | null;
  narrative: string;
}