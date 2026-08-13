"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPrice, listingTitle } from "@/lib/format";
import { setListingStatus } from "@/app/cabinet/listing-actions";

export type MyListing = {
  id: string;
  title: string | null;
  clean_description?: string | null;
  city: string | null;
  district: string | null;
  price: number | null;
  currency: string | null;
  status: string | null;
  photos: string[] | null;
  created_at: string | null;
};

// Статус оголошення власника людською мовою. 'removed' після модерації
// читаємо як «відхилено» — окремого 'rejected' у схемі немає.
const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "На модерації", cls: "bg-tertiary-container text-on-tertiary-container" },
  active: { label: "Опубліковано", cls: "bg-secondary-container text-on-secondary-container" },
  rented: { label: "Здано", cls: "bg-surface-container-high text-on-surface-variant" },
  expired: { label: "Неактивне", cls: "bg-surface-container-high text-on-surface-variant" },
  removed: { label: "Відхилено", cls: "bg-error-container text-on-error-container" },
};

export default function MyListings({ listings }: { listings: MyListing[] }) {
  const [items, setItems] = useState(listings);
  const [busy, setBusy] = useState<string | null>(null);

  async function change(id: string, status: "rented" | "active") {
    setBusy(id);
    const res = await setListingStatus(id, status);
    setBusy(null);
    if (res.ok) {
      setItems((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)));
    }
  }

  return (
    <section className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h3 className="font-headline-sm text-title-lg text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-primary">real_estate_agent</span>
          Мої оголошення
        </h3>
        <Link
          href="/post"
          className="shrink-0 inline-flex items-center gap-1 bg-primary text-on-primary font-label-md text-label-md px-3 py-1.5 rounded-lg hover:bg-primary-container active:scale-[0.98] transition-[background-color,transform]"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Розмістити
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="font-body-md text-body-md text-on-surface-variant py-4">
          Ви ще не розміщували оголошень. Здаєте квартиру? Опублікуйте її — без комісії та посередників.
        </p>
      ) : (
        <ul className="divide-y divide-surface-variant">
          {items.map((l) => {
            const st = STATUS[l.status ?? ""] ?? STATUS.pending;
            const cover = l.photos?.[0];
            const place = [l.district, l.city].filter(Boolean).join(", ") || "—";
            return (
              <li key={l.id} className="py-3 flex items-center gap-3">
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-surface-container-high shrink-0">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-on-surface-variant">
                      <span className="material-symbols-outlined">image</span>
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-grow">
                  {l.status === "active" ? (
                    <Link href={`/listings/${l.id}`} className="font-label-md text-label-md text-on-surface truncate block hover:text-primary transition-colors">
                      {listingTitle(l.title, l.clean_description)}
                    </Link>
                  ) : (
                    <p className="font-label-md text-label-md text-on-surface truncate">
                      {listingTitle(l.title, l.clean_description)}
                    </p>
                  )}
                  <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{place}</p>
                  {/* Дії власника: позначити зданою / повернути в каталог */}
                  {l.status === "active" && (
                    <button
                      onClick={() => change(l.id, "rented")}
                      disabled={busy === l.id}
                      className="mt-1 inline-flex items-center gap-1 font-caption text-caption text-on-surface-variant hover:text-primary disabled:opacity-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">task_alt</span>
                      {busy === l.id ? "…" : "Позначити зданою"}
                    </button>
                  )}
                  {l.status === "rented" && (
                    <button
                      onClick={() => change(l.id, "active")}
                      disabled={busy === l.id}
                      className="mt-1 inline-flex items-center gap-1 font-caption text-caption text-on-surface-variant hover:text-primary disabled:opacity-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">undo</span>
                      {busy === l.id ? "…" : "Повернути в каталог"}
                    </button>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <p className="font-label-md text-label-md text-on-surface">
                    {formatPrice(l.price, l.currency)}
                  </p>
                  <span className={`inline-block mt-1 font-caption text-caption px-2 py-0.5 rounded ${st.cls}`}>
                    {st.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
