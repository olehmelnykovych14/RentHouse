"use client";

import { useState } from "react";
import { CITIES } from "@/lib/cities";
import { saveAlert, toggleAlert } from "@/app/cabinet/alert-actions";

export type AlertSub = {
  city: string | null;
  district: string | null;
  price_min: number | null;
  price_max: number | null;
  rooms: number | null;
  rooms_plus: boolean;
  active: boolean;
  link_token: string;
  connected: boolean; // telegram_chat_id встановлено
};

export default function AlertSettings({
  sub,
  botUsername,
}: {
  sub: AlertSub | null;
  botUsername: string;
}) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(sub?.active ?? true);

  const roomsValue = sub?.rooms_plus ? "3+" : sub?.rooms ? String(sub.rooms) : "";
  // Deep-link працює лише коли критерії вже збережені (є токен). До того
  // пропонуємо спершу зберегти — інакше боту нічого прив'язувати.
  const deepLink = sub ? `https://t.me/${botUsername}?start=${sub.link_token}` : null;

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);
    const res = await saveAlert(formData);
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
          <span className="material-symbols-outlined text-[22px] text-primary">notifications_active</span>
          Telegram-сповіщення
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
          <span className="block font-label-sm text-label-sm text-on-surface-variant mb-1.5">Місто</span>
          <select
            name="city"
            defaultValue={sub?.city ?? ""}
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary"
          >
            <option value="">Будь-яке місто</option>
            {CITIES.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block font-label-sm text-label-sm text-on-surface-variant mb-1.5">Район (необовʼязково)</span>
          <input
            name="district"
            defaultValue={sub?.district ?? ""}
            maxLength={80}
            placeholder="напр. Сихів"
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder-outline focus:outline-none focus:border-primary"
          />
        </label>

        <div>
          <span className="block font-label-sm text-label-sm text-on-surface-variant mb-1.5">Ціна, ₴/міс</span>
          <div className="flex gap-3">
            <input
              name="price_min" type="number" min={0} step={500}
              defaultValue={sub?.price_min ?? ""}
              placeholder="Від"
              className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder-outline focus:outline-none focus:border-primary"
            />
            <input
              name="price_max" type="number" min={0} step={500}
              defaultValue={sub?.price_max ?? ""}
              placeholder="До"
              className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder-outline focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div>
          <span className="block font-label-sm text-label-sm text-on-surface-variant mb-1.5">Кімнати</span>
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

        {error && (
          <p className="bg-error-container text-on-error-container font-body-sm text-body-sm rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-primary text-on-primary font-label-md text-label-md py-2.5 rounded-lg hover:bg-primary-container active:scale-[0.99] transition-[background-color,transform] duration-200 disabled:opacity-50"
        >
          {busy ? "Збереження…" : saved ? "Збережено ✓" : "Зберегти критерії"}
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
