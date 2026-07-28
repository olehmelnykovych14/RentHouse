"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import type { Listing } from "@/lib/listings";
import { isLocked } from "@/lib/listing-view";
import { formatPrice, listingTitle } from "@/lib/format";
import FavoriteButton from "./FavoriteButton";

export default function CatalogCard({
  listing,
  favorited = false,
  index = 0,
}: {
  listing: Listing;
  favorited?: boolean;
  /** Порядок у сітці — щоб картки з'являлись каскадом, а не всі разом. */
  index?: number;
}) {
  const router = useRouter();
  const href = `/listings/${listing.id}`;
  const locked = isLocked(listing); // subscribed=false, поки нема auth
  const isNoFeeAgency = listing.listing_type === "agency_no_fee";
  // «Перевірений» — лише там, де джерело прямо назвало продавця власником.
  const verified = listing.owner_verified === true;
  const photos = listing.photos ?? [];
  const [photo, setPhoto] = useState(0);
  const location = [listing.city, listing.district].filter(Boolean).join(", ");
  const tags: string[] = [];
  if (listing.rooms) tags.push(`${listing.rooms} кімн.`);
  if (listing.area_sqm) tags.push(`${listing.area_sqm} м²`);
  if (listing.residential_complex) tags.push(listing.residential_complex);

  // Внутрішні кнопки не мають відкривати оголошення — гасимо сплиття.
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const flip = (e: React.MouseEvent, dir: 1 | -1) => {
    e.stopPropagation();
    setPhoto((p) => (p + dir + photos.length) % photos.length);
  };

  function open() {
    router.push(href);
  }

  return (
    <div
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter") open();
      }}
      role="link"
      tabIndex={0}
      aria-label={listingTitle(listing.title, listing.clean_description)}
      className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden hover:shadow-card-hover hover:-translate-y-1 transition-[transform,box-shadow] duration-300 ease-out-soft motion-safe:animate-fade-up group flex flex-col cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
    >
      <div className="relative h-48 w-full bg-surface-container overflow-hidden">
        {photos[photo] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photos[photo]}
            alt={listingTitle(listing.title, listing.clean_description)}
            className="w-full h-full object-cover transition-transform duration-500 ease-out-soft group-hover:scale-105"
          />
        )}

        {/* Гортання фото — лише коли їх більше одного */}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => flip(e, -1)}
              aria-label="Попереднє фото"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/35 hover:bg-black/55 text-white flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <button
              type="button"
              onClick={(e) => flip(e, 1)}
              aria-label="Наступне фото"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/35 hover:bg-black/55 text-white flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
              {photos.slice(0, 8).map((_, i) => (
                <span
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === photo ? "bg-white" : "bg-white/50"
                  }`}
                />
              ))}
            </div>
          </>
        )}

        <div className="absolute top-2 left-2 right-2 z-10 flex flex-wrap items-start justify-between gap-1.5 pointer-events-none">
          <div
            className={`backdrop-blur-sm px-2 py-1 rounded font-caption text-caption flex items-center gap-1 border shrink-0 ${
              verified
                ? "bg-secondary-fixed text-on-secondary-fixed border-secondary-fixed-dim"
                : "bg-surface-container-lowest/85 text-on-surface-variant border-outline-variant/40"
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {isNoFeeAgency ? "percent" : verified ? "verified" : "search"}
            </span>
            {isNoFeeAgency
              ? "Агенція • 0% комісії"
              : verified
                ? "Перевірений власник"
                : "Без ознак посередника"}
          </div>

          {!isNoFeeAgency && (
            <div className="ml-auto bg-brand-blue text-on-primary px-2 py-1 rounded font-caption text-caption flex items-center gap-1 shadow-sm shrink-0">
              🤖 AI: {listing.probability_of_owner ?? "?"}% власник
            </div>
          )}
        </div>

        {/* Обране — клік по серцю не відкриває оголошення */}
        <div onClick={stop} className="absolute bottom-2 right-2 z-20">
          <FavoriteButton
            listingId={listing.id}
            initial={favorited}
            className="w-9 h-9 rounded-full bg-surface-container-lowest/90 backdrop-blur-sm flex items-center justify-center shadow-sm transition-transform duration-200 ease-spring hover:scale-110 active:scale-95"
          />
        </div>
      </div>

      <div className="p-4 flex-grow flex flex-col">
        <div className="flex justify-between items-start mb-1 gap-2">
          <h3 className="font-headline-md text-headline-lg-mobile text-on-surface line-clamp-1">
            {listingTitle(listing.title, listing.clean_description)}
          </h3>
          <div className="font-display-lg text-[20px] text-brand-blue whitespace-nowrap">
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

        {/* Платним лишається КОНТАКТ, а не оголошення: фото, ціна й адреса
            видні всім. Кнопки гасять сплиття, щоб мати власну ціль. */}
        {locked ? (
          <Link
            href="/pricing"
            onClick={stop}
            className="flex items-center justify-center gap-2 text-center w-full bg-surface-container text-primary border border-outline-variant font-label-md text-label-md py-2.5 rounded-lg hover:bg-surface-container-high transition-colors duration-200"
          >
            <span className="material-symbols-outlined text-[18px]">lock</span>
            Розблокувати контакт
          </Link>
        ) : (
          <Link
            href={href}
            onClick={stop}
            className="block text-center w-full bg-brand-teal text-on-secondary font-label-md text-label-md py-2.5 rounded-lg hover:brightness-110 active:scale-[0.98] transition-[filter,transform] duration-200"
          >
            Зв&apos;язатися з власником
          </Link>
        )}
      </div>
    </div>
  );
}
