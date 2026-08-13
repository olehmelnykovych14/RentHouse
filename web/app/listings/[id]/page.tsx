import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getListingById, getFavoriteIds, getMedianPrice } from "@/lib/listings";
import { formatPrice, listingTitle, relativeDate } from "@/lib/format";
import { riskFlags } from "@/lib/risk";
import PhotoGallery from "@/components/PhotoGallery";
import FavoriteButton from "@/components/FavoriteButton";
import ReportButton from "@/components/ReportButton";
import ContactActions from "@/components/ContactActions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const listing = await getListingById(params.id);
  return {
    title: listing ? `${listingTitle(listing.title, listing.clean_description)} — RentDirect` : "Оголошення — RentDirect",
  };
}

export default async function ListingDetailPage({ params }: { params: { id: string } }) {
  const [listing, favIds] = await Promise.all([getListingById(params.id), getFavoriteIds()]);
  if (!listing) notFound();

  // Мітки ризику: текст опису + «дешевше за ринок» (нижче 60% медіани по місту).
  const median = await getMedianPrice(listing.city, listing.rooms);
  const belowMarket =
    median != null && listing.price_uah != null && listing.price_uah < median * 0.6;
  const flags = riskFlags(listing.clean_description, { belowMarket });

  const photos = listing.photos ?? [];
  const isOwner = listing.listing_type === "owner";
  const isNoFeeAgency = listing.listing_type === "agency_no_fee";
  const verified = listing.owner_verified === true;
  // Підписник: listings_public віддає original_url лише йому → це і є ознака доступу.
  const unlocked = !!listing.original_url;
  // Для не-підписника view маскує номер, але з порожнього seller_contact
  // маска дає порожній рядок — отже це і є ознака «контакту немає взагалі».
  const hasContact = Boolean(listing.seller_contact && listing.seller_contact.trim());
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
              {listingTitle(listing.title, listing.clean_description)}
            </h1>
            <div className="flex items-center gap-2 text-on-surface-variant font-body-md text-body-md flex-wrap">
              <span className="material-symbols-outlined text-[20px]">location_on</span>
              <span>{[listing.district, listing.city].filter(Boolean).join(", ") || "—"}</span>
              {listing.created_at && (
                <span className="flex items-center gap-1 text-outline font-caption text-caption">
                  <span className="material-symbols-outlined text-[16px]">schedule</span>
                  додано {relativeDate(listing.created_at)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary">
              <span className="whitespace-nowrap">{formatPrice(listing.price, listing.currency)}</span>{" "}
              <span className="font-body-md text-body-md text-on-surface-variant">/ міс</span>
            </span>
            <FavoriteButton
              listingId={listing.id}
              initial={favIds.has(listing.id)}
              className="w-11 h-11 rounded-full border border-surface-variant flex items-center justify-center shrink-0"
            />
          </div>
        </div>

        {/* Галерея з лайтбоксом */}
        <PhotoGallery photos={photos} title={listing.title ?? "Квартира"} />

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

            {/* На що звернути увагу — мітки ризику */}
            {flags.length > 0 && (
              <section className="bg-error-container/30 border border-error/20 rounded-xl p-5">
                <h2 className="font-headline-sm text-title-md text-error flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[20px]">gpp_maybe</span>
                  На що звернути увагу ({flags.length})
                </h2>
                <ul className="space-y-3">
                  {flags.map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <span
                        className={`material-symbols-outlined text-[18px] shrink-0 ${
                          f.high ? "text-error" : "text-tertiary"
                        }`}
                      >
                        {f.high ? "warning" : "info"}
                      </span>
                      <span>
                        <span className="font-label-md text-label-md text-on-surface">{f.label}.</span>{" "}
                        <span className="font-body-sm text-body-sm text-on-surface-variant">{f.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="font-caption text-caption text-on-surface-variant mt-3">
                  Це автоматична підказка за текстом і ціною, а не вирок. Перевіряйте квартиру особисто.
                </p>
              </section>
            )}

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

          {/* Sidebar — картка контакту */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-surface-container-lowest p-6 rounded-xl border border-surface-variant shadow-level-2">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[28px]">{isOwner ? "person" : "apartment"}</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-headline-md text-on-background">
                    {isOwner ? "Власник" : "Агенція"}
                  </h3>
                  <div
                    className={`px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider inline-flex items-center mt-1 ${
                      isOwner && !verified
                        ? "bg-surface-container text-on-surface-variant"
                        : "bg-secondary/10 text-secondary"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[12px] mr-1">
                      {isNoFeeAgency ? "percent" : isOwner ? (verified ? "verified" : "search") : "info"}
                    </span>
                    {/* Для агенції без комісії AI-оцінка «наскільки це власник»
                        нічого не пояснює — важлива саме відсутність комісії. */}
                    {isNoFeeAgency
                      ? "Без комісії"
                      : isOwner
                        ? verified
                          ? "Перевірений власник"
                          : "Ознак посередника не виявлено"
                        : `AI-оцінка ${listing.probability_of_owner ?? "?"}%`}
                  </div>
                  {isOwner && !verified && (
                    <p className="text-body-sm font-body-sm text-on-surface-variant mt-2 max-w-xs">
                      Джерело не вказало, хто подав оголошення. Ми не знайшли ознак
                      посередника, але це не те саме, що підтверджене власництво.
                    </p>
                  )}
                </div>
              </div>

              {/* Показуємо телефон ЛИШЕ там, де він справді є. Раніше тут
                  завжди стояла маска «+380 (••) •••-••-••», тож підписка
                  обіцяла номер навіть для оголошень, де його немає (dom.ria
                  і OLX ховають телефон за своїм віджетом) — і після оплати
                  людина бачила порожнє поле. */}
              <div className="mb-6 pb-6 border-b border-surface-variant">
                <div className="flex items-center gap-2 text-on-background font-label-md text-label-md mb-1">
                  <span className="material-symbols-outlined text-[18px] text-primary">
                    {hasContact ? "call" : "link"}
                  </span>
                  {hasContact
                    ? unlocked
                      ? listing.seller_contact
                      : "+380 (••) •••-••-••"
                    : "Контакт — в оригіналі оголошення"}
                </div>
                <p className="font-caption text-caption text-on-surface-variant">
                  {hasContact
                    ? unlocked
                      ? "Прямий контакт без комісії посередника."
                      : "Оформіть Premium, щоб відкрити прямий контакт власника без комісії."
                    : unlocked
                      ? "Тут номер не публікується — відкрийте оригінал і зв'яжіться напряму."
                      : "Джерело не публікує номер у тексті. Premium відкриває посилання на оригінал."}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {/* Є номер і доступ — даємо одразу подзвонити чи написати,
                    щоб не переписувати цифри вручну. */}
                {unlocked && hasContact ? (
                  <ContactActions contact={listing.seller_contact!} />
                ) : unlocked && listing.original_url ? (
                  <a
                    href={listing.original_url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full bg-primary text-on-primary font-label-md text-label-md py-3 rounded-lg hover:bg-primary-container transition-colors shadow-md flex justify-center items-center gap-2"
                  >
                    <span className="material-symbols-outlined">open_in_new</span>
                    Відкрити оригінал і контакт
                  </a>
                ) : (
                  <Link
                    href="/pricing"
                    className="w-full bg-primary text-on-primary font-label-md text-label-md py-3 rounded-lg hover:bg-primary-container transition-colors shadow-md flex justify-center items-center gap-2 ring-2 ring-primary-fixed"
                  >
                    <span className="material-symbols-outlined">workspace_premium</span>
                    Оформити Premium для перегляду
                  </Link>
                )}
              </div>

              {/* Скарга — стримано, під основними діями */}
              <div className="mt-4 pt-4 border-t border-surface-variant">
                <ReportButton listingId={listing.id} />
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
