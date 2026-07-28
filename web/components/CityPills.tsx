import Link from "next/link";
import type { CityCount } from "@/lib/listings";

type SearchParams = { [key: string]: string | string[] | undefined };

/**
 * Пігулки-перемикачі міст угорі каталогу. Клік = фільтр на місто (той самий
 * city-параметр, що й у сайдбарі), решта фільтрів зберігається. «Усі» — знімає
 * місто. Сортовані за кількістю; активне підсвічене.
 */
export default function CityPills({
  counts,
  total,
  active,
  searchParams,
}: {
  counts: CityCount[];
  total: number;
  active?: string;
  searchParams: SearchParams;
}) {
  function href(city: string | null): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === "city") continue; // місто задаємо самі нижче
      const val = Array.isArray(v) ? v[0] : v;
      if (val) params.set(k, val);
    }
    if (city) params.set("city", city);
    const qs = params.toString();
    return qs ? `/listings?${qs}` : "/listings";
  }

  if (counts.length <= 1) return null; // нема сенсу в пігулках для одного міста

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      <Pill href={href(null)} label="Усі" count={total} active={!active} />
      {counts.map((c) => (
        <Pill key={c.city} href={href(c.city)} label={c.city} count={c.count} active={active === c.city} />
      ))}
    </div>
  );
}

function Pill({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border font-label-md text-label-md transition-colors ${
        active
          ? "bg-primary text-on-primary border-primary"
          : "bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-primary/50 hover:text-on-surface"
      }`}
    >
      {label}
      <span
        className={`font-caption text-caption px-1.5 rounded-full ${
          active ? "bg-on-primary/20 text-on-primary" : "bg-surface-container-high text-on-surface-variant"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}
