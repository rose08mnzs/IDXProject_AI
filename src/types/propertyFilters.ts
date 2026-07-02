export interface PropertyFilters {
  city: string | null;
  maxPrice: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  type: string | null;
  pool: "True" | null;
  hasView: "True" | null;
  maxHoa: number | null;
}

export function createEmptyPropertyFilters(): PropertyFilters {
  return {
    city: null,
    maxPrice: null,
    beds: null,
    baths: null,
    sqft: null,
    type: null,
    pool: null,
    hasView: null,
    maxHoa: null,
  };
}