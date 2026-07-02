import assert from "node:assert/strict";
import { parsePropertyQuery } from "../parser/propertyParser";

type PartialExpected = {
  city?: string | null;
  maxPrice?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  type?: string | null;
  pool?: "True" | null;
  hasView?: "True" | null;
  maxHoa?: number | null;
};

function pickRelevant(result: Awaited<ReturnType<typeof parsePropertyQuery>>) {
  return {
    city: result.city,
    maxPrice: result.maxPrice,
    beds: result.beds,
    baths: result.baths,
    sqft: result.sqft,
    type: result.type,
    pool: result.pool,
    hasView: result.hasView,
    maxHoa: result.maxHoa,
  };
}

async function runCase(name: string, query: string, expected: PartialExpected) {
  const result = await parsePropertyQuery(query);
  const actual = pickRelevant(result);

  for (const [key, value] of Object.entries(expected)) {
    assert.deepEqual(
      actual[key as keyof typeof actual],
      value,
      `${name} failed for ${key}. Actual: ${actual[key as keyof typeof actual]}`
    );
  }

  console.log(`PASS - ${name}`);
}

async function main() {
  await runCase("City only", "Show me homes in Irvine", {
    city: "Irvine",
  });

  await runCase("Condo + city", "Show me condos in Irvine", {
    city: "Irvine",
    type: "Condominium",
  });

  await runCase("Under price with M suffix", "Homes in Newport Beach under $1.5M", {
    city: "Newport Beach",
    maxPrice: 1500000,
  });

  await runCase("Under price with k suffix", "Homes under $850k in Fairfax ", {
    city: "Fairfax",
    maxPrice: 850000,
  });

  await runCase("Beds", "3 bed-room homes", {
    beds: 3,
  });

  await runCase("Beds and baths", "6 beds 3 baths in Pasadena", {
    city: "Pasadena",
    beds: 6,
    baths: 3,
  });

  await runCase("Sqft", "Single family homes over 2000 square ft", {
    type: "SingleFamilyResidence",
    sqft: 2000,
  });

  await runCase("Pool", "town homes with a pool in Irvine", {
    city: "Irvine",
    pool: "True",
  });

  await runCase("View", "Homes with a beach view ", {
    hasView: "True",
  });

  await runCase("HOA", "Studio in San Francisco with HOA 500", {
    city: "San Francisco",
    type: "Studio",
    maxHoa: 500,
  });

  await runCase("Full mixed query", "3-bedroom condo in Irvine under $2M with pool and view", {
    city: "Irvine",
    maxPrice: 2000000,
    beds: 3,
    type: "Condominium",
    pool: "True",
    hasView: "True",
  });

  console.log("All Week 2 parser tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});