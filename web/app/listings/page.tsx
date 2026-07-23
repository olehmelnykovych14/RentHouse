import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FilterSidebar from "@/components/FilterSidebar";
import CatalogCard from "@/components/CatalogCard";
import { getListings, getFavoriteIds, type ListingFilters } from "@/lib/listings";

export const dynamic = "force-dynamic";

export const metadata = { title: "Каталог квартир від власників — RentDirect" };

type SearchParams = { [key: string]: string | string[] | undefined };

function toFilters(sp: SearchParams): ListingFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return {
    q: one(sp.q),
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
  const [{ listings, count }, favIds] = await Promise.all([getListings(filters), getFavoriteIds()]);

  return (
    <>
      <Navbar />
      <main className="flex-grow pt-[104px] px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto w-full flex flex-col md:flex-row gap-gutter pb-16">
        <FilterSidebar filters={filters} />

        <section className="w-full md:w-3/4 flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div className="font-body-md text-body-md text-on-surface-variant">
              Знайдено {count} {count === 1 ? "оголошення" : "оголошень"}
            </div>
            <div className="flex bg-surface-container-low rounded-lg p-1 border border-outline-variant/20">
              <button className="px-3 py-1 rounded bg-surface-container-lowest text-primary shadow-sm flex items-center gap-1 font-label-md text-label-md">
                <span className="material-symbols-outlined text-[20px]">list</span> Список
              </button>
              <button className="px-3 py-1 rounded text-on-surface-variant hover:text-on-surface flex items-center gap-1 font-label-md text-label-md transition-colors" title="Скоро">
                <span className="material-symbols-outlined text-[20px]">map</span> Карта
              </button>
            </div>
          </div>

          {listings.length === 0 ? (
            <div className="text-center py-24 text-on-surface-variant">
              <span className="material-symbols-outlined text-[48px] mb-2">search_off</span>
              <p className="font-body-md text-body-md">За такими фільтрами нічого не знайдено.</p>
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
