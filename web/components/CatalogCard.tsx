import Link from "next/link";
import { type Listing, isLocked } from "@/lib/listings";
import { formatPrice } from "@/lib/format";
import FavoriteButton from "./FavoriteButton";

export default function CatalogCard({ listing, favorited = false }: { listing: Listing; favorited?: boolean }) {
  const locked = isLocked(listing); // subscribed=false, поки нема auth
  const photo = listing.photos?.[0];
  const location = [listing.city, listing.district].filter(Boolean).join(", ");
  const tags: string[] = [];
  if (listing.rooms) tags.push(`${listing.rooms} кімн.`);
  if (listing.area_sqm) tags.push(`${listing.area_sqm} м²`);
  if (listing.residential_complex) tags.push(listing.residential_complex);

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden hover:shadow-level-2 transition-shadow group flex flex-col">
      <div className="relative h-48 w-full bg-surface-container">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={listing.title ?? "Квартира"}
            className={`w-full h-full object-cover ${locked ? "blur-md scale-105" : ""}`}
          />
        )}

        {/* AI-оцінка власника (зліва) */}
        <div className="absolute top-2 left-2 z-10 bg-primary text-on-primary px-2 py-1 rounded font-caption text-caption flex items-center gap-1 shadow-sm">
          🤖 AI-Оцінка: {listing.probability_of_owner ?? "?"}% Власник
        </div>

        {/* Значок «власник» (справа) */}
        <div className="absolute top-2 right-2 z-10 bg-secondary/10 text-secondary-container backdrop-blur-sm px-2 py-1 rounded font-caption text-caption flex items-center gap-1 border border-secondary/20">
          <span className="material-symbols-outlined text-[14px]">verified</span> Власник
        </div>

        {/* Обране */}
        <FavoriteButton
          listingId={listing.id}
          initial={favorited}
          className="absolute bottom-2 right-2 z-20 w-9 h-9 rounded-full bg-surface-container-lowest/90 backdrop-blur-sm flex items-center justify-center shadow-sm"
        />

        {/* Замок paywall для свіжих оголошень */}
        {locked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-on-surface/40 text-on-primary p-4 text-center">
            <span className="material-symbols-outlined text-[32px] mb-1">lock</span>
            <span className="font-label-md text-label-md">Ексклюзивно для Premium на 24 години</span>
          </div>
        )}
      </div>

      <div className="p-4 flex-grow flex flex-col">
        <div className="flex justify-between items-start mb-1 gap-2">
          <h3 className="font-headline-md text-headline-lg-mobile text-on-surface line-clamp-1">
            {listing.title ?? "Квартира"}
          </h3>
          <div className="font-display-lg text-[20px] text-primary whitespace-nowrap">
            {formatPrice(listing.price, listing.currency)}
          </div>
        </div>

        <p className="font-caption text-caption text-on-surface-variant mb-4 flex items-center">
          <span className="material-symbols-outlined text-[16px] mr-1">location_on</span>
          {location || "—"}
        </p>

        <div className="flex flex-wrap gap-2 mb-6 mt-auto">
          {tags.map((t) => (
            <span key={t} className="bg-surface-container-low px-2 py-1 rounded text-on-surface-variant font-caption text-caption">
              {t}
            </span>
          ))}
        </div>

        {locked ? (
          <Link
            href="/pricing"
            className="block text-center w-full bg-secondary text-on-secondary font-label-md text-label-md py-2.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            🔓 Відкрити контакти
          </Link>
        ) : (
          <Link
            href={`/listings/${listing.id}`}
            className="block text-center w-full bg-primary/5 text-primary border border-primary/20 font-label-md text-label-md py-2.5 rounded-lg hover:bg-primary hover:text-on-primary transition-colors"
          >
            Детальніше
          </Link>
        )}
      </div>
    </div>
  );
}
