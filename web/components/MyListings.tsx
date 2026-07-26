import Link from "next/link";
import { formatPrice } from "@/lib/format";

export type MyListing = {
  id: string;
  title: string | null;
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

      {listings.length === 0 ? (
        <p className="font-body-md text-body-md text-on-surface-variant py-4">
          Ви ще не розміщували оголошень. Здаєте квартиру? Опублікуйте її — без комісії та посередників.
        </p>
      ) : (
        <ul className="divide-y divide-surface-variant">
          {listings.map((l) => {
            const st = STATUS[l.status ?? ""] ?? STATUS.pending;
            const cover = l.photos?.[0];
            const place = [l.district, l.city].filter(Boolean).join(", ") || "—";
            // На модерації сторінки деталей ще немає (її показує лише каталог
            // після схвалення), тож клікабельні тільки опубліковані.
            const inner = (
              <>
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
                  <p className="font-label-md text-label-md text-on-surface truncate">
                    {l.title || "Оголошення"}
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{place}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-label-md text-label-md text-on-surface">
                    {formatPrice(l.price, l.currency)}
                  </p>
                  <span className={`inline-block mt-1 font-caption text-caption px-2 py-0.5 rounded ${st.cls}`}>
                    {st.label}
                  </span>
                </div>
              </>
            );
            return (
              <li key={l.id}>
                {l.status === "active" ? (
                  <Link href={`/listings/${l.id}`} className="flex items-center gap-3 py-3 hover:opacity-80 transition-opacity">
                    {inner}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 py-3">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
