"use client";

import { useState } from "react";
import { formatPrice, listingTitle, relativeDate } from "@/lib/format";
import { approveListing, rejectListing } from "@/app/admin/actions";

export type PendingListing = {
  id: string;
  title: string | null;
  clean_description: string | null;
  price: number | null;
  currency: string | null;
  city: string | null;
  district: string | null;
  rooms: number | null;
  area_sqm: number | null;
  seller_contact: string | null;
  photos: string[] | null;
  created_at: string | null;
  source: string | null;
};

export default function ModerationQueue({ listings }: { listings: PendingListing[] }) {
  const [items, setItems] = useState(listings);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, kind: "approve" | "reject") {
    setBusy(id);
    setError(null);
    const res = kind === "approve" ? await approveListing(id) : await rejectListing(id);
    setBusy(null);
    if (res.ok) {
      setItems((xs) => xs.filter((x) => x.id !== id)); // прибираємо з черги
    } else {
      setError(res.error);
    }
  }

  if (items.length === 0) {
    return (
      <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-10 text-center">
        <span className="material-symbols-outlined text-[40px] text-secondary">inbox</span>
        <p className="font-body-md text-body-md text-on-surface-variant mt-2">
          Черга порожня — усі оголошення оброблені.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-gutter">
      {error && (
        <p className="bg-error-container text-on-error-container font-body-sm text-body-sm rounded-lg px-4 py-3">
          {error}
        </p>
      )}
      {items.map((l) => {
        const place = [l.district, l.city].filter(Boolean).join(", ") || "—";
        const tags = [l.rooms ? `${l.rooms} кімн.` : "", l.area_sqm ? `${l.area_sqm} м²` : ""].filter(Boolean);
        return (
          <article
            key={l.id}
            className="bg-surface-container-lowest border border-surface-variant rounded-xl overflow-hidden flex flex-col md:flex-row"
          >
            {/* Фото */}
            <div className="md:w-64 shrink-0 bg-surface-container-high">
              {l.photos && l.photos.length > 0 ? (
                <div className="flex md:flex-col h-40 md:h-full overflow-x-auto md:overflow-y-auto">
                  {l.photos.slice(0, 4).map((p, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={p} alt="" className="h-40 md:h-32 w-full object-cover shrink-0" />
                  ))}
                </div>
              ) : (
                <div className="h-40 md:h-full flex items-center justify-center text-on-surface-variant">
                  <span className="material-symbols-outlined">image</span>
                </div>
              )}
            </div>

            {/* Деталі */}
            <div className="flex-grow p-5 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-headline-sm text-title-lg text-on-surface">
                  {listingTitle(l.title, l.clean_description)}
                </h3>
                <span className="font-display-lg text-[20px] text-brand-blue whitespace-nowrap">
                  {formatPrice(l.price, l.currency)}
                </span>
              </div>
              <p className="font-caption text-caption text-on-surface-variant flex items-center gap-2 flex-wrap">
                <span className="material-symbols-outlined text-[16px]">location_on</span>
                {place}
                {tags.map((t) => (
                  <span key={t} className="bg-surface-container-low px-2 py-0.5 rounded">{t}</span>
                ))}
                <span className="text-outline">· {relativeDate(l.created_at)}</span>
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-3">
                {l.clean_description || "Опис відсутній."}
              </p>
              <p className="font-label-md text-label-md text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-primary">call</span>
                {l.seller_contact || "контакт не вказано"}
              </p>

              <div className="flex gap-3 mt-auto pt-2">
                <button
                  onClick={() => act(l.id, "approve")}
                  disabled={busy === l.id}
                  className="inline-flex items-center gap-1.5 bg-secondary text-on-secondary font-label-md text-label-md px-4 py-2 rounded-lg hover:brightness-110 active:scale-[0.98] transition disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">check</span>
                  Схвалити
                </button>
                <button
                  onClick={() => act(l.id, "reject")}
                  disabled={busy === l.id}
                  className="inline-flex items-center gap-1.5 border border-outline-variant text-error font-label-md text-label-md px-4 py-2 rounded-lg hover:bg-error-container/40 active:scale-[0.98] transition disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                  Відхилити
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
