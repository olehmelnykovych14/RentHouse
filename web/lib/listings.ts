import { createSupabaseServer } from "./supabase/server";

// Клієнт-безпечний хелпер живе окремо (без next/headers), щоб клієнтські
// компоненти могли його імпортувати; тут ре-експортуємо для сервера.
export { isLocked } from "./listing-view";

export type Listing = {
  id: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  price_uah: number | null;
  rooms: number | null;
  district: string | null;
  city: string | null;
  area_sqm: number | null;
  property_type: string | null;
  residential_complex: string | null;
  listing_type: string | null;
  /** true лише коли джерело прямо назвало продавця власником (див. migrations/002). */
  owner_verified: boolean | null;
  commission: string | null;
  commission_verified: boolean | null;
  probability_of_owner: number | null;
  photos: string[] | null;
  created_at: string | null;
  // Додаткові поля для сторінки деталей (необов'язкові — моки їх не мають)
  floor?: number | null;
  total_floors?: number | null;
  has_furniture?: boolean | null;
  lat?: number | null;
  lng?: number | null;
  clean_description?: string | null;
  seller_contact?: string | null;
  original_url?: string | null;
  source?: string | null;
};

/**
 * Що взагалі потрапляє в каталог. Звичайні агенції (`agency`) не показуємо —
 * обіцянка продукту саме в тому, що їх тут немає. `agency_no_fee` показуємо,
 * але карточка позначає їх як агенцію з 0% комісії, а не як власника.
 */
const CATALOG_TYPES = ["owner", "agency_no_fee"];

const SELECT_COLS =
  "id,title,price,currency,price_uah,rooms,district,city,area_sqm,property_type,residential_complex,listing_type,owner_verified,commission,commission_verified,probability_of_owner,photos,created_at";

// Мок-дані для розробки, поки Supabase не підключено (з дизайну Stitch).
const MOCK_LISTINGS: Listing[] = [
  {
    id: "mock-1", title: "2-кімнатна квартира", price: 15000, currency: "UAH", price_uah: 15000,
    rooms: 2, district: "Печерський р-н", city: "Київ", area_sqm: 65,
    property_type: "apartment", residential_complex: null, listing_type: "owner", owner_verified: true,
    commission: "0%", commission_verified: true, probability_of_owner: 95,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // свіже → замок
    photos: ["https://lh3.googleusercontent.com/aida-public/AB6AXuBnNOgvowNbF4IjICU05KP9LfcBvN0zF0c3dawAFLQMWQJzRqB5M0eX33UP2QIlK7P0zsurMC0hrfUUuCC8TpFoWMJszMZ-mMHhSBqi78rB-eglovcpT3IBxFg_ocvL6uwRRF2cUVSFfelO7eRupPkebuY-kwmQ6HeyDa0PUawET-eoYtviBmFbL8x-GiIBM85Gz6-Ro8exVPdCi4xooL30mD8_Wvet-3ecgSZU7DY39_q-eU33W6Tt"],
  },
  {
    id: "mock-2", title: "3-кімнатна квартира", price: 22000, currency: "UAH", price_uah: 22000,
    rooms: 3, district: "Сихівський р-н", city: "Львів", area_sqm: 80,
    property_type: "apartment", residential_complex: "Новобудова", listing_type: "owner", owner_verified: true,
    commission: null, commission_verified: false, probability_of_owner: 90,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    photos: ["https://lh3.googleusercontent.com/aida-public/AB6AXuCbrz7Gc3tzmISdUrr7Bf5OH7_tmI_LzKcpznu9v7LaiZoCwPFtedMF83Zp_STTZ7_KY7mNDYjV1s3wy35rCFnKDjJ_VYV6sytc9rjjwM7kOhpkk29T8arLLUuxeT-ynerst9dYP89w74t34o6Cf8LaURUQje132seB1r2rgXObkqiB543kUNSeysQh4Nxok7bs7NNuJIHURV7dXKeRikhf8iFZIfrANEStbP0TskyVUXaIgDSkGqYI"],
  },
  {
    id: "mock-3", title: "1-кімнатна квартира", price: 12500, currency: "UAH", price_uah: 12500,
    rooms: 1, district: "Приморський р-н", city: "Одеса", area_sqm: 45,
    property_type: "apartment", residential_complex: null, listing_type: "owner", owner_verified: true,
    commission: null, commission_verified: false, probability_of_owner: 88,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    photos: ["https://lh3.googleusercontent.com/aida-public/AB6AXuA4znIIEOc6dgbv6BDVYvb4O0qN8VfdS65ySu4iS2HwoAp_jCJjkVP971n44KJrYH-dJ6ofqlb2fJH05qWtiUKPjIhLj5r-23JqzVcnrkfavKgPdUhVJod59_tb1wYcLZCzBwCdlw2Y98n9MwOXFnMPO53-mHHbkoIozXfBBpm_tyCYPndX5D3Aj08xhN9cFokFEYuzxVoZsW4XPIGoHuqSkJyRiOXNdzRI88oj99VnkT2Bk50Qx3K6"],
  },
];

/**
 * Популярні оголошення для головної. Читає listings_public (тільки власники),
 * падає на мок-дані, якщо Supabase не налаштовано або запит невдалий.
 */
export async function getPopularListings(limit = 3): Promise<Listing[]> {
  const supabase = createSupabaseServer();
  if (!supabase) return MOCK_LISTINGS.slice(0, limit);

  const { data, error } = await supabase
    .from("listings_public")
    .select(SELECT_COLS)
    .in("listing_type", CATALOG_TYPES)
    .order("probability_of_owner", { ascending: false })
    .limit(limit);

  // Помилка запиту — це НЕ привід показувати моки: користувач побачив би
  // вигадані квартири як справжні. Краще порожньо й помилка в лог.
  if (error) {
    console.error("[listings] Supabase:", error.message);
    return [];
  }
  return (data as unknown as Listing[]) ?? [];
}

// ─────────────────────────────────────────────
// Каталог з фільтрами
// ─────────────────────────────────────────────
export type ListingFilters = {
  q?: string;
  city?: string;
  property_type?: string;
  price_min?: string;
  price_max?: string;
  rooms?: string;
  floor?: string;
  area_min?: string;
  area_max?: string;
  furnished?: string;
};

/**
 * Оголошення каталогу з застосованими фільтрами. Повертає рядки + загальну кількість.
 * Падає на мок-дані, якщо Supabase не налаштовано.
 */
const num = (v?: string) => (v && !Number.isNaN(Number(v)) ? Number(v) : undefined);

/**
 * Застосовує фільтри каталогу до запиту. `includeCity=false` навмисно пропускає
 * місто — так підрахунок по містах (пігулки) бачить усі міста за інших фільтрів.
 * Тип query — `any`: дженерики PostgREST-білдера тут лише заважають.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyCatalogFilters(query: any, f: ListingFilters, includeCity: boolean): any {
  if (includeCity && f.city) query = query.eq("city", f.city);
  if (f.property_type) query = query.eq("property_type", f.property_type);
  const pMin = num(f.price_min);
  const pMax = num(f.price_max);
  // Ціна фільтрується в гривні (price_uah), бо оголошення бувають у USD/EUR.
  if (pMin !== undefined) query = query.gte("price_uah", pMin);
  if (pMax !== undefined) query = query.lte("price_uah", pMax);
  const aMin = num(f.area_min);
  const aMax = num(f.area_max);
  if (aMin !== undefined) query = query.gte("area_sqm", aMin);
  if (aMax !== undefined) query = query.lte("area_sqm", aMax);
  if (f.rooms === "3+") query = query.gte("rooms", 3);
  else if (num(f.rooms) !== undefined) query = query.eq("rooms", num(f.rooms));
  if (num(f.floor) !== undefined) query = query.eq("floor", num(f.floor));
  if (f.furnished === "on" || f.furnished === "true") query = query.eq("has_furniture", true);
  if (f.q) query = query.or(`district.ilike.%${f.q}%,city.ilike.%${f.q}%`);
  return query;
}

export async function getListings(
  f: ListingFilters
): Promise<{ listings: Listing[]; count: number }> {
  const supabase = createSupabaseServer();
  if (!supabase) return { listings: MOCK_LISTINGS, count: MOCK_LISTINGS.length };

  let query = supabase
    .from("listings_public")
    .select(SELECT_COLS, { count: "exact" })
    .in("listing_type", CATALOG_TYPES);
  query = applyCatalogFilters(query, f, true);

  const { data, error, count } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("[listings] Supabase:", error.message);
    return { listings: [], count: 0 };
  }
  return { listings: (data as unknown as Listing[]) ?? [], count: count ?? 0 };
}

export type CityCount = { city: string; count: number };

/**
 * Кількість оголошень по містах за поточних фільтрів (окрім самого міста) —
 * для пігулок-перемикачів угорі каталогу. total = «Усі» за тих самих фільтрів.
 */
export async function getCityCounts(
  f: ListingFilters
): Promise<{ counts: CityCount[]; total: number }> {
  const supabase = createSupabaseServer();
  if (!supabase) {
    const m = new Map<string, number>();
    for (const l of MOCK_LISTINGS) m.set(l.city ?? "—", (m.get(l.city ?? "—") ?? 0) + 1);
    const counts = [...m].map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count);
    return { counts, total: MOCK_LISTINGS.length };
  }

  let query = supabase.from("listings_public").select("city").in("listing_type", CATALOG_TYPES);
  query = applyCatalogFilters(query, f, false);

  const { data, error } = await query.limit(2000);
  if (error) {
    console.error("[listings] getCityCounts:", error.message);
    return { counts: [], total: 0 };
  }
  const rows = (data as unknown as { city: string | null }[]) ?? [];
  const m = new Map<string, number>();
  for (const r of rows) {
    const c = (r.city ?? "").trim();
    if (c) m.set(c, (m.get(c) ?? 0) + 1);
  }
  const counts = [...m]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, "uk"));
  return { counts, total: rows.length };
}

// ─────────────────────────────────────────────
// Обране (Favorites)
// ─────────────────────────────────────────────

/** Set id-ів оголошень, які поточний користувач додав в обране (порожній, якщо не залогінений). */
export async function getFavoriteIds(): Promise<Set<string>> {
  const supabase = createSupabaseServer();
  if (!supabase) return new Set();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();
  const { data } = await supabase.from("favorites").select("listing_id").eq("user_id", user.id);
  return new Set((data ?? []).map((r: { listing_id: string }) => r.listing_id));
}

/**
 * Пул для стрічки свайпів: оголошення, яких ще НЕ в обраному.
 * Спочатку найсвіжіші, з обмеженням — картки все одно гортають по одній.
 */
export async function getSwipeListings(limit = 40): Promise<Listing[]> {
  const supabase = createSupabaseServer();
  if (!supabase) return MOCK_LISTINGS;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let excludeIds: string[] = [];
  if (user) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id);
    excludeIds = (favs ?? []).map((r: { listing_id: string }) => r.listing_id);
  }

  let query = supabase
    .from("listings_public")
    .select(SELECT_COLS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (excludeIds.length) {
    // Postgrest очікує список у дужках: (id1,id2,…)
    query = query.not("id", "in", `(${excludeIds.join(",")})`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[swipe] Supabase:", error.message);
    return [];
  }
  return (data as unknown as Listing[]) ?? [];
}

/** Оголошення, які користувач додав в обране (для сторінки /favorites). */
export async function getFavoriteListings(): Promise<Listing[]> {
  const supabase = createSupabaseServer();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: favs } = await supabase.from("favorites").select("listing_id").eq("user_id", user.id);
  const ids = (favs ?? []).map((r: { listing_id: string }) => r.listing_id);
  if (ids.length === 0) return [];
  const { data } = await supabase.from("listings_public").select(SELECT_COLS).in("id", ids);
  return (data as unknown as Listing[]) ?? [];
}

/**
 * Медіана ціни (грн) схожих оголошень у місті — база для сигналу «дешевше за
 * ринок». null, якщо порівнянних менше 5 (мала вибірка ненадійна).
 */
export async function getMedianPrice(
  city: string | null,
  rooms: number | null
): Promise<number | null> {
  const supabase = createSupabaseServer();
  if (!supabase || !city) return null;
  let q = supabase
    .from("listings_public")
    .select("price_uah")
    .in("listing_type", CATALOG_TYPES)
    .eq("city", city)
    .not("price_uah", "is", null);
  if (rooms != null) q = q.eq("rooms", rooms);
  const { data } = await q.limit(500);
  const prices = (data ?? [])
    .map((r: { price_uah: number | null }) => r.price_uah)
    .filter((n): n is number => typeof n === "number" && n > 0)
    .sort((a, b) => a - b);
  if (prices.length < 5) return null;
  const mid = Math.floor(prices.length / 2);
  return prices.length % 2 ? prices[mid] : Math.round((prices[mid - 1] + prices[mid]) / 2);
}

const DETAIL_COLS =
  SELECT_COLS +
  ",floor,total_floors,has_furniture,lat,lng,clean_description,seller_contact,original_url,source";

/** Одне оголошення для сторінки деталей. null, якщо не знайдено. */
export async function getListingById(id: string): Promise<Listing | null> {
  const supabase = createSupabaseServer();
  if (!supabase) return MOCK_LISTINGS.find((l) => l.id === id) ?? MOCK_LISTINGS[0] ?? null;

  const { data, error } = await supabase
    .from("listings_public")
    .select(DETAIL_COLS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[listings] getListingById:", error.message);
    return null;
  }
  return (data as unknown as Listing) ?? null;
}
