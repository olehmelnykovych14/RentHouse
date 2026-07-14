import { getSupabase } from "./supabase";

export type Listing = {
  id: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  rooms: number | null;
  district: string | null;
  city: string | null;
  area_sqm: number | null;
  property_type: string | null;
  residential_complex: string | null;
  listing_type: string | null;
  commission: string | null;
  commission_verified: boolean | null;
  probability_of_owner: number | null;
  photos: string[] | null;
};

// Мок-дані для розробки, поки Supabase не підключено (з дизайну Stitch).
const MOCK_LISTINGS: Listing[] = [
  {
    id: "mock-1", title: "2-кімнатна квартира", price: 15000, currency: "UAH",
    rooms: 2, district: "Печерський р-н", city: "Київ", area_sqm: 65,
    property_type: "apartment", residential_complex: null, listing_type: "owner",
    commission: "0%", commission_verified: true, probability_of_owner: 95,
    photos: ["https://lh3.googleusercontent.com/aida-public/AB6AXuBnNOgvowNbF4IjICU05KP9LfcBvN0zF0c3dawAFLQMWQJzRqB5M0eX33UP2QIlK7P0zsurMC0hrfUUuCC8TpFoWMJszMZ-mMHhSBqi78rB-eglovcpT3IBxFg_ocvL6uwRRF2cUVSFfelO7eRupPkebuY-kwmQ6HeyDa0PUawET-eoYtviBmFbL8x-GiIBM85Gz6-Ro8exVPdCi4xooL30mD8_Wvet-3ecgSZU7DY39_q-eU33W6Tt"],
  },
  {
    id: "mock-2", title: "3-кімнатна квартира", price: 22000, currency: "UAH",
    rooms: 3, district: "Сихівський р-н", city: "Львів", area_sqm: 80,
    property_type: "apartment", residential_complex: "Новобудова", listing_type: "owner",
    commission: null, commission_verified: false, probability_of_owner: 90,
    photos: ["https://lh3.googleusercontent.com/aida-public/AB6AXuCbrz7Gc3tzmISdUrr7Bf5OH7_tmI_LzKcpznu9v7LaiZoCwPFtedMF83Zp_STTZ7_KY7mNDYjV1s3wy35rCFnKDjJ_VYV6sytc9rjjwM7kOhpkk29T8arLLUuxeT-ynerst9dYP89w74t34o6Cf8LaURUQje132seB1r2rgXObkqiB543kUNSeysQh4Nxok7bs7NNuJIHURV7dXKeRikhf8iFZIfrANEStbP0TskyVUXaIgDSkGqYI"],
  },
  {
    id: "mock-3", title: "1-кімнатна квартира", price: 12500, currency: "UAH",
    rooms: 1, district: "Приморський р-н", city: "Одеса", area_sqm: 45,
    property_type: "apartment", residential_complex: null, listing_type: "owner",
    commission: null, commission_verified: false, probability_of_owner: 88,
    photos: ["https://lh3.googleusercontent.com/aida-public/AB6AXuA4znIIEOc6dgbv6BDVYvb4O0qN8VfdS65ySu4iS2HwoAp_jCJjkVP971n44KJrYH-dJ6ofqlb2fJH05qWtiUKPjIhLj5r-23JqzVcnrkfavKgPdUhVJod59_tb1wYcLZCzBwCdlw2Y98n9MwOXFnMPO53-mHHbkoIozXfBBpm_tyCYPndX5D3Aj08xhN9cFokFEYuzxVoZsW4XPIGoHuqSkJyRiOXNdzRI88oj99VnkT2Bk50Qx3K6"],
  },
];

/**
 * Популярні оголошення для головної. Читає listings_public (тільки власники),
 * падає на мок-дані, якщо Supabase не налаштовано або запит невдалий.
 */
export async function getPopularListings(limit = 3): Promise<Listing[]> {
  const supabase = getSupabase();
  if (!supabase) return MOCK_LISTINGS.slice(0, limit);

  const { data, error } = await supabase
    .from("listings_public")
    .select(
      "id,title,price,currency,rooms,district,city,area_sqm,property_type,residential_complex,listing_type,commission,commission_verified,probability_of_owner,photos"
    )
    .eq("listing_type", "owner")
    .order("probability_of_owner", { ascending: false })
    .limit(limit);

  if (error || !data || data.length === 0) return MOCK_LISTINGS.slice(0, limit);
  return data as Listing[];
}
