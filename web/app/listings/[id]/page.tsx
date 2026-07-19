import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getListingById, isLocked } from "@/lib/listings";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const listing = await getListingById(params.id);
  return { title: listing?.title ? `${listing.title} — RentDirect` : "Оголошення — RentDirect" };
}

export default async function ListingDetailPage({ params }: { params: { id: string } }) {
  const listing = await getListingById(params.id);
  if (!listing) notFound();

  const locked = isLocked(listing); // subscribed=false, поки нема auth
  const photos = listing.photos ?? [];
  const mainPhoto = photos[0];
  const isOwner = listing.listing_type === "owner";
  const floorText =
    listing.floor && listing.total_floors
      ? `${listing.floor} / ${listing.total_floors}`
      : listing.floor
        ? String(listing.floor)
        : "—";
  const hasMap = listing.lat != null && listing.lng != null;
  const bbox = hasMap
    ? `${listing.lng! - 0.01},${listing.lat! - 0.008},${listing.lng! + 0.01},${listing.lat! + 0.008}`
    : "";

  return (
    <>
      <Navbar />
      <main className="flex-grow pt-[88px] px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto w-full pb-16">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 mb-6 text-on-surface-variant font-caption text-caption flex-wrap">
          <Link href="/listings" className="hover:text-primary transition-colors">
            {listing.city ?? "Каталог"}
          </Link>
          {listing.district && (
            <>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              <span className="text-on-background font-medium">{listing.district}</span>
            </>
          )}
        </div>

        {/* Title + price */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-gutter gap-4">
          <div>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background mb-2">
              {listing.title ?? "Квартира"}
            </h1>
            <div className="flex items-center gap-2 text-on-surface-variant font-body-md text-body-md">
              <span className="material-symbols-outlined text-[20px]">location_on</span>
              <span>{[listing.district, listing.city].filter(Boolean).join(", ") || "—"}</span>
            </div>
          </div>
          <div className="flex flex-col items-start md:items-end">
            <span className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary">
              {formatPrice(listing.price, listing.currency)}{" "}
              <span className="font-body-md text-body-md text-on-surface-variant">/ міс</span>
            </span>
          </div>
        </div>

        {/* Gallery */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-base mb-12 h-[320px] md:h-[440px] rounded-xl overflow-hidden">
          <div className="md:col-span-2 relative bg-surface-container-low overflow-hidden">
            {mainPhoto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mainPhoto} alt={listing.title ?? "Квартира"} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="relative bg-surface-container-low overflow-hidden hidden md:flex items-center justify-center">
            {mainPhoto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mainPhoto}
                alt=""
                className={`w-full h-full object-cover ${locked ? "blur-md scale-105" : ""}`}
              />
            )}
            {locked && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-on-surface/40 text-on-primary text-center p-4">
                <span className="material-symbols-outlined text-[32px] mb-1">lock</span>
                <span className="font-label-md text-label-md">Всі фото — для Premium</span>
              </div>
            )}
          </div>
        </div>

        {/* Content + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
          {/* Left */}
          <div className="lg:col-span-2 flex flex-col gap-12">
            {/* Key stats */}
            <div className="flex flex-wrap gap-6 md:gap-8 bg-surface-container-lowest p-6 rounded-xl border border-surface-variant">
              <Stat icon="straighten" label="Площа" value={listing.area_sqm ? `${listing.area_sqm} м²` : "—"} />
              <Stat icon="meeting_room" label="Кімнати" value={listing.rooms ? String(listing.rooms) : "—"} />
              <Stat icon="stairs" label="Поверх" value={floorText} />
            </div>

            {/* Description */}
            <section>
              <h2 className="font-headline-md text-headline-md text-on-background mb-4">Опис</h2>
              <p className="font-body-md text-body-md text-on-surface-variant whitespace-pre-line">
                {listing.clean_description || "Опис відсутній."}
              </p>
            </section>

            {/* Amenities (наразі лише меблі) */}
            {listing.has_furniture != null && (
              <section>
                <h2 className="font-headline-md text-headline-md text-on-background mb-4">Зручності</h2>
                <div className="flex flex-wrap gap-3">
                  <Amenity icon="chair" label={listing.has_furniture ? "Мебльована" : "Без меблів"} />
                </div>
              </section>
            )}

            {/* Location */}
            {hasMap && (
              <section>
                <h2 className="font-headline-md text-headline-md text-on-background mb-4">Локація</h2>
                <div className="w-full h-72 rounded-xl overflow-hidden border border-surface-variant">
                  <iframe
                    title="Карта"
                    className="w-full h-full"
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${listing.lat},${listing.lng}`}
                  />
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-surface-container-lowest p-6 rounded-xl border border-surface-variant shadow-level-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined">{isOwner ? "person" : "apartment"}</span>
                </div>
                <div>
                  <h3 className="font-label-md text-label-md text-on-background">
                    {isOwner ? "Власник" : "Агенція"}
                  </h3>
                  <div className="bg-secondary/10 text-secondary px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider inline-flex items-center mt-1">
                    <span className="material-symbols-outlined text-[12px] mr-1">
                      {isOwner ? "verified" : "info"}
                    </span>
                    {isOwner ? "Перевірений власник" : `AI-оцінка ${listing.probability_of_owner ?? "?"}%`}
                  </div>
                </div>
              </div>

              <p className="font-caption text-caption text-on-surface-variant mb-6 pb-6 border-b border-surface-variant">
                {locked ? "+380 (••) •••-••-••" : listing.seller_contact || "Контакт у джерелі"}
                <br />
                Прямий контакт без комісії посередника.
              </p>

              <div className="flex flex-col gap-3">
                {locked ? (
                  <Link
                    href="/pricing"
                    className="w-full bg-primary text-on-primary font-label-md text-label-md py-3 rounded-lg hover:bg-primary-container transition-colors shadow-md flex justify-center items-center gap-2"
                  >
                    <span className="material-symbols-outlined">workspace_premium</span>
                    Оформити Premium для перегляду
                  </Link>
                ) : (
                  listing.original_url && (
                    <a
                      href={listing.original_url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full bg-primary text-on-primary font-label-md text-label-md py-3 rounded-lg hover:bg-primary-container transition-colors shadow-md flex justify-center items-center gap-2"
                    >
                      <span className="material-symbols-outlined">open_in_new</span>
                      Відкрити оригінал
                    </a>
                  )
                )}
                <button className="w-full bg-transparent border border-primary text-primary font-label-md text-label-md py-3 rounded-lg hover:bg-primary/5 transition-colors flex justify-center items-center gap-2">
                  <span className="material-symbols-outlined">calendar_month</span>
                  Забронювати перегляд
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="bg-primary/10 p-2 rounded-full text-primary">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div>
        <p className="font-caption text-caption text-on-surface-variant">{label}</p>
        <p className="font-label-md text-label-md text-on-background">{value}</p>
      </div>
    </div>
  );
}

function Amenity({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="bg-surface-container-low px-4 py-2 rounded-full flex items-center gap-2 border border-surface-variant">
      <span className="material-symbols-outlined text-[18px] text-on-surface-variant">{icon}</span>
      <span className="font-caption text-caption text-on-background">{label}</span>
    </div>
  );
}
