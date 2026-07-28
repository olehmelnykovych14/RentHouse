import Link from "next/link";
import type { ListingFilters } from "@/lib/listings";
import { CITIES } from "@/lib/cities";

const inputCls =
  "w-full bg-surface-container-lowest border border-outline-variant/50 rounded-lg p-2 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all";

// Зручності: тільки Furnished зараз фільтрує (є колонка has_furniture).
// Решта — UI-заготовки під майбутні колонки зручностей.
const AMENITIES = [
  { name: "furnished", label: "Мебльована", active: true },
  { name: "appliances", label: "Техніка включена", active: false },
  { name: "pet_friendly", label: "Можна з тваринами", active: false },
  { name: "parking", label: "Паркомісце", active: false },
];

export default function FilterSidebar({ filters }: { filters: ListingFilters }) {
  return (
    <aside className="w-full md:w-1/4 flex-shrink-0 md:sticky md:top-[104px] md:self-start md:max-h-[calc(100vh-104px-1rem)] md:overflow-y-auto md:pr-1">
      <form
        action="/listings"
        method="get"
        className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/30"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-headline-md text-headline-md text-on-surface">Фільтри</h2>
          <Link href="/listings" className="font-caption text-caption text-primary hover:underline">
            Скинути
          </Link>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2">Місто</label>
            <select name="city" defaultValue={filters.city ?? ""} className={inputCls}>
              <option value="">Будь-яке</option>
              {CITIES.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2">Тип житла</label>
            <select name="property_type" defaultValue={filters.property_type ?? ""} className={inputCls}>
              <option value="">Будь-який</option>
              <option value="apartment">Квартира</option>
              <option value="house">Будинок</option>
              <option value="studio">Студія</option>
              <option value="room">Кімната</option>
            </select>
          </div>

          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2">Ціна /міс</label>
            <div className="flex gap-2">
              <input name="price_min" type="number" placeholder="Від" defaultValue={filters.price_min ?? ""} className={inputCls} />
              <input name="price_max" type="number" placeholder="До" defaultValue={filters.price_max ?? ""} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2">Кімнати</label>
            <select name="rooms" defaultValue={filters.rooms ?? ""} className={inputCls}>
              <option value="">Будь-яка</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3+">3+</option>
            </select>
          </div>

          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2">Поверх</label>
            <input name="floor" type="number" placeholder="напр. 2" defaultValue={filters.floor ?? ""} className={inputCls} />
          </div>

          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2">Площа, м²</label>
            <div className="flex gap-2">
              <input name="area_min" type="number" placeholder="Від" defaultValue={filters.area_min ?? ""} className={inputCls} />
              <input name="area_max" type="number" placeholder="До" defaultValue={filters.area_max ?? ""} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2">Зручності</label>
            <div className="space-y-2">
              {AMENITIES.map((a) => (
                <label
                  key={a.name}
                  className={`flex items-center gap-2 ${a.active ? "cursor-pointer" : "opacity-40 cursor-not-allowed"}`}
                >
                  <input
                    type="checkbox"
                    name={a.name}
                    disabled={!a.active}
                    defaultChecked={a.name === "furnished" && !!filters.furnished}
                    className="rounded border-outline-variant/50 text-primary focus:ring-primary"
                  />
                  <span className="font-body-md text-body-md text-on-surface-variant">{a.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-primary text-on-primary font-label-md text-label-md py-2.5 rounded-lg hover:bg-primary-container transition-colors"
          >
            Застосувати
          </button>
        </div>
      </form>
    </aside>
  );
}
