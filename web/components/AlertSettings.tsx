"use client";

import { useState } from "react";
import Link from "next/link";
import { CITIES } from "@/lib/cities";
import { saveAlert, toggleAlert } from "@/app/cabinet/alert-actions";

export type AlertSub = {
  city: string | null;
  districts: string[];
  property_type: string | null;
  price_min: number | null;
  price_max: number | null;
  rooms: number | null;
  rooms_plus: boolean;
  instant: boolean;
  active: boolean;
  link_token: string;
  connected: boolean; // telegram_chat_id встановлено
};

const PROPERTY_TYPES = [
  { value: "", label: "Будь-який" },
  { value: "apartment", label: "Квартира" },
  { value: "house", label: "Будинок" },
  { value: "studio", label: "Студія" },
];

const inputCls =
  "w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder-outline focus:outline-none focus:border-primary";
const labelCls = "block font-label-sm text-label-sm text-on-surface-variant mb-1.5";

export default function AlertSettings({
  sub,
  botUsername,
  districtsByCity,
  isPremium,
}: {
  sub: AlertSub | null;
  botUsername: string;
  districtsByCity: Record<string, string[]>;
  isPremium: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(sub?.active ?? true);

  // Контрольований стан для полів, які не є простими інпутами.
  const [city, setCity] = useState(sub?.city ?? "");
  const [districts, setDistricts] = useState<string[]>(sub?.districts ?? []);
  const [propertyType, setPropertyType] = useState(sub?.property_type ?? "");
  const [instant, setInstant] = useState(isPremium ? sub?.instant ?? false : false);
  const [showUpsell, setShowUpsell] = useState(false);

  const roomsValue = sub?.rooms_plus ? "3+" : sub?.rooms ? String(sub.rooms) : "";
  const availableDistricts = city ? districtsByCity[city] ?? [] : [];
  const deepLink = sub ? `https://t.me/${botUsername}?start=${sub.link_token}` : null;

  function onCityChange(next: string) {
    setCity(next);
    // Райони прив'язані до міста — при зміні лишаємо тільки ті, що є в новому.
    const allowed = new Set(districtsByCity[next] ?? []);
    setDistricts((ds) => ds.filter((d) => allowed.has(d)));
  }

  function toggleDistrict(d: string) {
    setDistricts((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));
  }

  function onInstantToggle() {
    if (!isPremium) {
      setShowUpsell(true);
      return;
    }
    setInstant((v) => !v);
  }

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);

    const int = (k: string): number | null => {
      const v = formData.get(k);
      if (v == null || String(v).trim() === "") return null;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
    };
    const roomsRaw = String(formData.get("rooms") ?? "").trim();
    const roomsPlus = roomsRaw === "3+";

    const res = await saveAlert({
      city: city.trim() || null,
      districts,
      property_type: propertyType || null,
      price_min: int("price_min"),
      price_max: int("price_max"),
      rooms: roomsPlus ? 3 : int("rooms"),
      rooms_plus: roomsPlus,
      instant,
    });

    setBusy(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else {
      setError(res.error);
    }
  }

  return (
    <section className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h3 className="font-headline-sm text-title-lg text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-primary">radar</span>
          Радар нових квартир
        </h3>
        {sub?.connected && (
          <button
            onClick={async () => {
              const next = !active;
              setActive(next);
              const res = await toggleAlert(next);
              if (!res.ok) setActive(!next);
            }}
            className={`shrink-0 relative w-11 h-6 rounded-full transition-colors ${
              active ? "bg-secondary" : "bg-surface-container-high"
            }`}
            aria-label={active ? "Вимкнути сповіщення" : "Увімкнути сповіщення"}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-surface-container-lowest shadow-sm transition-transform ${
                active ? "translate-x-5" : ""
              }`}
            />
          </button>
        )}
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-5">
        Отримуйте нові квартири від власників у Telegram, щойно вони зʼявляються.
      </p>

      <form action={submit} className="space-y-4">
        <label className="block">
          <span className={labelCls}>Місто</span>
          <select
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            className={inputCls}
          >
            <option value="">Будь-яке місто</option>
            {CITIES.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </label>

        {/* Райони — мультивибір, залежить від міста */}
        <div>
          <span className={labelCls}>
            Райони {districts.length > 0 && <span className="text-primary">· обрано {districts.length}</span>}
          </span>
          {!city ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Спершу оберіть місто, щоб звузити до конкретних районів.
            </p>
          ) : availableDistricts.length === 0 ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Для «{city}» ще немає даних по районах — сповіщення йтимуть по всьому місту.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableDistricts.map((d) => {
                const on = districts.includes(d);
                return (
                  <button
                    type="button"
                    key={d}
                    onClick={() => toggleDistrict(d)}
                    className={`px-3 py-1.5 rounded-full border font-label-sm text-label-sm transition-colors ${
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-outline-variant text-on-surface-variant hover:border-primary/50"
                    }`}
                  >
                    {on && <span className="material-symbols-outlined text-[14px] align-middle mr-1">check</span>}
                    {d}
                  </button>
                );
              })}
            </div>
          )}
          {city && districts.length === 0 && availableDistricts.length > 0 && (
            <p className="font-caption text-caption text-on-surface-variant mt-1.5">
              Нічого не обрано — надсилатимемо по всіх районах міста.
            </p>
          )}
        </div>

        <div>
          <span className={labelCls}>Тип житла</span>
          <div className="flex gap-2">
            {PROPERTY_TYPES.map((t) => (
              <button
                type="button"
                key={t.value || "any"}
                onClick={() => setPropertyType(t.value)}
                className={`flex-1 py-2 rounded-lg border font-label-md text-label-md transition-colors ${
                  propertyType === t.value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-outline-variant text-on-surface-variant hover:border-primary/50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={labelCls}>Ціна, ₴/міс</span>
          <div className="flex gap-3">
            <input
              name="price_min" type="number" min={0} step={500}
              defaultValue={sub?.price_min ?? ""}
              placeholder="Від"
              className={inputCls}
            />
            <input
              name="price_max" type="number" min={0} step={500}
              defaultValue={sub?.price_max ?? ""}
              placeholder="До"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <span className={labelCls}>Кімнати</span>
          <div className="flex gap-2">
            {["", "1", "2", "3+"].map((r) => (
              <label key={r || "any"} className="flex-1">
                <input type="radio" name="rooms" value={r} defaultChecked={roomsValue === r} className="peer sr-only" />
                <span className="block text-center py-2 rounded-lg border border-outline-variant font-label-md text-label-md text-on-surface-variant cursor-pointer peer-checked:border-primary peer-checked:bg-primary/5 peer-checked:text-primary transition-colors">
                  {r || "Будь-яка"}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Преміум: миттєва доставка */}
        <div className="border border-outline-variant rounded-lg p-4 bg-surface-container-low">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="font-label-md text-label-md text-on-surface flex items-center gap-2">
                Миттєва доставка
                <span className="inline-flex items-center gap-1 bg-tertiary-container text-on-tertiary-container font-caption text-caption px-1.5 py-0.5 rounded">
                  <span className="material-symbols-outlined text-[12px]">star</span>Premium
                </span>
              </span>
              <p className="font-caption text-caption text-on-surface-variant mt-0.5">
                Без підписки — раз на день згорнутим дайджестом. З Premium — щойно зʼявляється.
              </p>
            </div>
            <button
              type="button"
              onClick={onInstantToggle}
              className={`shrink-0 relative w-11 h-6 rounded-full transition-colors ${
                instant ? "bg-secondary" : "bg-surface-container-high"
              } ${!isPremium ? "opacity-60" : ""}`}
              aria-label="Миттєва доставка"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-surface-container-lowest shadow-sm transition-transform ${
                  instant ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>
          {showUpsell && !isPremium && (
            <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant">
              Миттєві сповіщення доступні на Premium.{" "}
              <Link href="/pricing" className="text-primary underline">Оформити підписку →</Link>
            </p>
          )}
        </div>

        {error && (
          <p className="bg-error-container text-on-error-container font-body-sm text-body-sm rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-primary text-on-primary font-label-md text-label-md py-2.5 rounded-lg hover:bg-primary-container active:scale-[0.99] transition-[background-color,transform] duration-200 disabled:opacity-50"
        >
          {busy ? "Збереження…" : saved ? "Збережено ✓" : "Активувати радар"}
        </button>
      </form>

      {/* Прив'язка Telegram */}
      <div className="mt-5 pt-5 border-t border-surface-variant">
        {sub?.connected ? (
          <div className="flex items-center gap-2 text-secondary font-label-md text-label-md">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
            Telegram підключено
          </div>
        ) : deepLink ? (
          <a
            href={deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-brand-teal text-on-secondary font-label-md text-label-md py-2.5 rounded-lg hover:brightness-110 active:scale-[0.99] transition-[filter,transform] duration-200"
          >
            <span className="material-symbols-outlined text-[20px]">send</span>
            Підключити Telegram-бота
          </a>
        ) : (
          <p className="font-body-sm text-body-sm text-on-surface-variant text-center">
            Спочатку збережіть критерії, тоді зʼявиться кнопка підключення Telegram.
          </p>
        )}
      </div>
    </section>
  );
}
