import Link from "next/link";
import type { Listing } from "@/lib/listings";
import { formatPrice } from "@/lib/format";

function badge(listing: Listing): { text: string; icon: string } {
  if (listing.listing_type === "agency_no_fee") return { text: "Агенція • 0%", icon: "verified" };
  if (listing.listing_type === "agency") return { text: "Агенція", icon: "apartment" };
  return { text: "Від власника", icon: "verified" };
}

export default function ListingCard({ listing }: { listing: Listing }) {
  const b = badge(listing);
  const photo = listing.photos?.[0];
  const tags: string[] = [];
  if (listing.rooms) tags.push(`${listing.rooms} кімн.`);
  if (listing.area_sqm) tags.push(`${listing.area_sqm} м²`);
  if (listing.residential_complex) tags.push(listing.residential_complex);

  const location = [listing.city, listing.district].filter(Boolean).join(", ");

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden hover:shadow-level-2 transition-shadow group relative">
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-container">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={listing.title ?? "Квартира"}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-outline">
            <span className="material-symbols-outlined text-[48px]">apartment</span>
          </div>
        )}
        <div className="absolute top-4 left-4 bg-secondary/10 text-secondary-container backdrop-blur-sm px-3 py-1 rounded-full font-caption text-caption flex items-center border border-secondary/20">
          <span className="material-symbols-outlined text-[16px] mr-1">{b.icon}</span> {b.text}
        </div>
      </div>

      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-headline-md text-headline-md text-on-surface">
            {formatPrice(listing.price, listing.currency)}{" "}
            <span className="font-body-md text-body-md text-on-surface-variant">/міс</span>
          </h3>
          <button className="text-outline hover:text-error transition-colors" aria-label="В обране">
            <span className="material-symbols-outlined">favorite_border</span>
          </button>
        </div>

        <p className="font-body-md text-body-md text-on-surface-variant mb-4 flex items-center">
          <span className="material-symbols-outlined text-[18px] mr-1">location_on</span> {location || "—"}
        </p>

        <div className="flex gap-2 flex-wrap mb-4">
          {tags.map((t) => (
            <span key={t} className="bg-surface-container text-on-surface-variant font-caption text-caption px-2 py-1 rounded-md">
              {t}
            </span>
          ))}
        </div>

        <Link
          href={`/listings/${listing.id}`}
          className="block text-center w-full bg-primary/5 text-primary border border-primary/20 font-label-md text-label-md py-2 rounded-lg hover:bg-primary hover:text-on-primary transition-colors"
        >
          Детальніше
        </Link>
      </div>
    </div>
  );
}
