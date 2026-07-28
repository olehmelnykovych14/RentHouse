import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FilterSidebar from "@/components/FilterSidebar";
import CityPills from "@/components/CityPills";
import CatalogCard from "@/components/CatalogCard";
import { getListings, getCityCounts, getFavoriteIds, type Listing, type ListingFilters } from "@/lib/listings";

export const dynamic = "force-dynamic";

export const metadata = { title: "Каталог квартир від власників — RentDirect" };

type SearchParams = { [key: string]: string | string[] | undefined };

function toFilters(sp: SearchParams): ListingFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return {
    q: one(sp.q),
    city: one(sp.city),
    property_type: one(sp.property_type),
    price_min: one(sp.price_min),
    price_max: one(sp.price_max),
    rooms: one(sp.rooms),
    floor: one(sp.floor),
    area_min: one(sp.area_min),
    area_max: one(sp.area_max),
    furnished: one(sp.furnished),
  };
}

export default async function ListingsPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = toFilters(searchParams);
  const [{ listings, count }, cityData, favIds] = await Promise.all([
    getListings(filters),
    getCityCounts(filters),
    getFavoriteIds(),
  ]);

  // Групуємо за містом лише коли місто не обране — тоді плоский мікс стає
  // впорядкованими секціями. Порядок секцій = порядок пігулок (за кількістю).
  const grouped = !filters.city && listings.length > 0;
  const cityGroups = grouped ? groupByCity(listings, cityData.counts.map((c) => c.city)) : [];

  return (
    <>
      <Navbar />
      <main className="flex-grow pt-[104px] px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto w-full flex flex-col md:flex-row gap-gutter pb-16">
        <FilterSidebar filters={filters} />

        <section className="w-full md:w-3/4 flex flex-col gap-6">
          <CityPills
            counts={cityData.counts}
            total={cityData.total}
            active={filters.city}
            searchParams={searchParams}
          />

          <div className="flex justify-between items-center">
            <div className="font-body-md text-body-md text-on-surface-variant">
              Знайдено {count} {count === 1 ? "оголошення" : "оголошень"}
              {filters.city ? ` · ${filters.city}` : ""}
            </div>
            <div className="flex bg-surface-container-low rounded-lg p-1 border border-outline-variant/20">
              <button className="px-3 py-1 rounded bg-surface-container-lowest text-primary shadow-sm flex items-center gap-1 font-label-md text-label-md">
                <span className="material-symbols-outlined text-[20px]">list</span>
                <span className="hidden sm:inline">Список</span>
              </button>
              <Link
                href="/swipe"
                className="px-3 py-1 rounded text-on-surface-variant hover:text-on-surface flex items-center gap-1 font-label-md text-label-md transition-colors"
                title="Гортати картки, як у застосунку знайомств"
              >
                <span className="material-symbols-outlined text-[20px]">style</span>
                <span className="hidden sm:inline">Гортати</span>
              </Link>
            </div>
          </div>

          {listings.length === 0 ? (
            <div className="text-center py-24 text-on-surface-variant">
              <span className="material-symbols-outlined text-[48px] mb-2">search_off</span>
              <p className="font-body-md text-body-md">За такими фільтрами нічого не знайдено.</p>
            </div>
          ) : grouped ? (
            <div className="flex flex-col gap-8">
              {cityGroups.map((g) => (
                <section key={g.city}>
                  <h2 className="font-headline-sm text-title-lg text-on-surface flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[20px] text-primary">location_city</span>
                    {g.city}
                    <span className="font-caption text-caption text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">
                      {g.listings.length}
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
                    {g.listings.map((l, i) => (
                      <CatalogCard key={l.id} listing={l} favorited={favIds.has(l.id)} index={i} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
              {listings.map((l, i) => (
                <CatalogCard key={l.id} listing={l} favorited={favIds.has(l.id)} index={i} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

/** Розкладає оголошення по містах у заданому порядку; невідоме місто — в кінець. */
function groupByCity(
  listings: Listing[],
  order: string[]
): { city: string; listings: Listing[] }[] {
  const byCity = new Map<string, Listing[]>();
  for (const l of listings) {
    const c = (l.city ?? "").trim() || "Інше";
    if (!byCity.has(c)) byCity.set(c, []);
    byCity.get(c)!.push(l);
  }
  const seen = new Set<string>();
  const groups: { city: string; listings: Listing[] }[] = [];
  for (const city of order) {
    if (byCity.has(city)) {
      groups.push({ city, listings: byCity.get(city)! });
      seen.add(city);
    }
  }
  // Міста, яких не було в order (напр. "Інше" або нове), — у кінець.
  for (const [city, ls] of byCity) {
    if (!seen.has(city)) groups.push({ city, listings: ls });
  }
  return groups;
}
