export type AwaitingField =
  | "city"
  | "budget"
  | "beds"
  | "baths"
  | "type"
  | null;


export type MarketAwaitingField = "city" | null;
export interface UserSession {
  city: string | null;
  maxPrice: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  type: string | null;
  pool: "True" | null;
  hasView: "True" | null;
  maxHoa: number | null;

  awaiting: AwaitingField;
  step: number;

  lastResults: ListingRow[];

  updatedAt: number;
  priceAnswered: boolean;
  bedsAnswered: boolean;
  bathsAnswered: boolean;
  typeAnswered: boolean;

  marketAwaiting?: MarketAwaitingField;
  marketCity?: string | null;
  marketZip?: string | null;
  marketPropertyType?: string | null;
  marketMonths?: number | null;
}

export function createEmptySession(): UserSession {
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

    awaiting: null,
    step: 0,

    lastResults: [],

    updatedAt: Date.now(),

    marketAwaiting: null,
    marketCity: null,
    marketZip: null,
    marketPropertyType: null,
    marketMonths: null,
  };
}

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

export interface ListingRow  {
  L_ListingID: string;
  L_DisplayId: string;
  L_Address: string;
  L_City: string;
  L_Zip: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  type: string;
  status: string;
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
}

export interface SoldRow {
  ListingKey: string;
  UnparsedAddress: string;
  City: string;
  CloseDate: string;
  ClosePrice: number;
  OriginalListPrice: number | null;
  ListPrice: number | null;
  DaysOnMarket: number | null;
  BedroomsTotal: number | null;
  BathroomsTotalInteger: number | null;
  LivingArea: number | null;
  PropertyType: string;
  PropertySubType: string | null;
  YearBuilt: number | null;
  ListAgentFullName: string | null;
  ListOfficeName: string | null;
  BuyerOfficeName: string | null;
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