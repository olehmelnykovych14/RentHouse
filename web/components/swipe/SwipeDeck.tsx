"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Listing } from "@/lib/listings";
import { formatPrice } from "@/lib/format";
import { likeListing, unlikeListing } from "@/app/swipe/actions";

type Decision = "like" | "nope";
type Done = { listing: Listing; decision: Decision };

// Порогова відстань, після якої відпускання = рішення. Нижче — картка
// повертається на місце. Швидкий короткий флік теж спрацьовує (див. onUp).
const SWIPE_THRESHOLD = 90;
const FLICK_VELOCITY = 0.6; // px/ms

// Пропущені картки тримаємо локально: без окремої таблиці «показаних» це
// єдиний спосіб не показувати те саме двічі. Лайки живуть у базі (favorites).
const SKIP_KEY = "rd_swipe_skipped";

function loadSkipped(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(SKIP_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveSkipped(ids: Set<string>) {
  try {
    localStorage.setItem(SKIP_KEY, JSON.stringify([...ids].slice(-500)));
  } catch {
    /* приватний режим — не критично */
  }
}

export default function SwipeDeck({ listings }: { listings: Listing[] }) {
  const router = useRouter();
  const [deck, setDeck] = useState<Listing[]>(listings);
  const [ready, setReady] = useState(false);
  const [history, setHistory] = useState<Done[]>([]);
  const [needAuth, setNeedAuth] = useState(false);

  // Жест верхньої картки. Тримаємо в ref, щоб pointermove не перерендерював
  // на кожен піксель; у стан пишемо через rAF.
  const drag = useRef({ startX: 0, startY: 0, dx: 0, dy: 0, active: false, t0: 0 });
  const [tick, setTick] = useState({ dx: 0, dy: 0, active: false });
  const [flyOut, setFlyOut] = useState<Decision | null>(null);
  const raf = useRef<number | null>(null);

  // Прибираємо вже пропущені при монтуванні (localStorage доступний лише
  // на клієнті, тож не в серверному запиті).
  useEffect(() => {
    const skipped = loadSkipped();
    setDeck((d) => d.filter((l) => !skipped.has(l.id)));
    setReady(true);
  }, []);

  const top = deck[0];
  const next = deck[1];

  // Активне фото верхньої картки. Свайп зайнятий рішенням, тож фото гортаємо
  // тапом по половинах (як у застосунках знайомств); тап розпізнаємо в onUp.
  const [photoIdx, setPhotoIdx] = useState(0);
  useEffect(() => {
    setPhotoIdx(0); // нова картка зверху — показуємо з першого фото
  }, [top?.id]);

  const topPhotos = top?.photos ?? [];

  function stepPhoto(dir: 1 | -1) {
    if (topPhotos.length < 2) return;
    setPhotoIdx((i) => Math.min(topPhotos.length - 1, Math.max(0, i + dir)));
  }

  function schedule() {
    if (raf.current != null) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = null;
      setTick({ dx: drag.current.dx, dy: drag.current.dy, active: drag.current.active });
    });
  }

  function onDown(e: React.PointerEvent) {
    if (flyOut) return;
    // Захоплення вказівника — щоб рух за межами картки все одно ловився.
    // Деякі движки кидають на цьому виклику; для жесту він не обов'язковий.
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* без захоплення теж працює */
    }
    drag.current = { startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, active: true, t0: performance.now() };
    schedule();
  }

  function onMove(e: React.PointerEvent) {
    if (!drag.current.active) return;
    drag.current.dx = e.clientX - drag.current.startX;
    drag.current.dy = e.clientY - drag.current.startY;
    schedule();
  }

  function onUp(e: React.PointerEvent) {
    if (!drag.current.active) return;
    const { dx, dy, t0 } = drag.current;
    const dt = Math.max(1, performance.now() - t0);
    const velocity = Math.abs(dx) / dt;
    const decided = Math.abs(dx) > SWIPE_THRESHOLD || velocity > FLICK_VELOCITY;

    drag.current.active = false;

    if (decided) {
      commit(dx > 0 ? "like" : "nope");
      return;
    }

    // Майже без руху — це тап, а не свайп. Ліва третина картки гортає фото
    // назад, решта — вперед (порядок як у Tinder/Instagram Stories).
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const rel = (e.clientX - rect.left) / rect.width;
      stepPhoto(rel < 0.33 ? -1 : 1);
    }

    // Не дотягнув — плавно назад.
    drag.current.dx = 0;
    drag.current.dy = 0;
    setTick({ dx: 0, dy: 0, active: false });
  }

  function commit(decision: Decision) {
    if (!top) return;
    const card = top;
    setFlyOut(decision);

    if (decision === "like") {
      likeListing(card.id).then((res) => {
        if (!res.ok && "needAuth" in res && res.needAuth) setNeedAuth(true);
      });
    } else {
      const skipped = loadSkipped();
      skipped.add(card.id);
      saveSkipped(skipped);
    }

    // Даємо картці долетіти за екран, тоді знімаємо її з колоди.
    window.setTimeout(() => {
      setHistory((h) => [{ listing: card, decision }, ...h]);
      setDeck((d) => d.slice(1));
      drag.current = { startX: 0, startY: 0, dx: 0, dy: 0, active: false, t0: 0 };
      setTick({ dx: 0, dy: 0, active: false });
      setFlyOut(null);
    }, 280);
  }

  function undo() {
    const [last, ...rest] = history;
    if (!last) return;
    setHistory(rest);
    setDeck((d) => [last.listing, ...d]);

    if (last.decision === "like") {
      unlikeListing(last.listing.id);
    } else {
      const skipped = loadSkipped();
      skipped.delete(last.listing.id);
      saveSkipped(skipped);
    }
  }

  // Клавіатура — стрічка має працювати й на десктопі, не лише пальцем.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (flyOut || !top) return;
      if (e.key === "ArrowRight") commit("like");
      else if (e.key === "ArrowLeft") commit("nope");
      else if (e.key === "ArrowDown") undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top, flyOut, history]);

  if (!ready) {
    return <div className="h-[70vh] rounded-3xl skeleton" />;
  }

  if (!top) {
    return (
      <div className="text-center py-16 px-6">
        <span className="material-symbols-outlined text-[48px] text-outline">done_all</span>
        <h2 className="font-headline-md text-headline-md text-on-surface mt-3 mb-2">
          Ви переглянули всі
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant mb-6">
          {history.some((h) => h.decision === "like")
            ? "Уподобані квартири чекають у розділі «Обране»."
            : "Загляньте пізніше — щодня додаються нові оголошення."}
        </p>
        <div className="flex flex-col gap-3">
          {history.length > 0 && (
            <button
              onClick={undo}
              className="inline-flex items-center justify-center gap-2 bg-surface-container text-on-surface font-label-md text-label-md px-6 py-3 rounded-full hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">undo</span>
              Повернути останню
            </button>
          )}
          <Link
            href="/favorites"
            className="inline-flex items-center justify-center gap-2 bg-brand-teal text-on-secondary font-label-md text-label-md px-6 py-3 rounded-full hover:brightness-110 transition-[filter]"
          >
            <span className="material-symbols-outlined text-[18px]">favorite</span>
            До обраного
          </Link>
        </div>
      </div>
    );
  }

  // Трансформація верхньої картки.
  const dx = flyOut ? (flyOut === "like" ? 1 : -1) * (window.innerWidth || 500) : tick.dx;
  const dy = flyOut ? tick.dy : tick.dy;
  const rot = dx / 18; // невеликий нахил у бік руху
  const dragging = tick.active && !flyOut;
  const likeOpacity = Math.max(0, Math.min(1, dx / SWIPE_THRESHOLD));
  const nopeOpacity = Math.max(0, Math.min(1, -dx / SWIPE_THRESHOLD));

  return (
    <div className="select-none">
      {needAuth && (
        <div className="mb-4 bg-primary-fixed text-on-primary-fixed rounded-xl px-4 py-3 text-center">
          <p className="font-body-sm text-body-sm mb-2">Щоб зберігати вподобані, увійдіть.</p>
          <Link href="/login" className="font-label-md text-label-md underline">
            Увійти
          </Link>
        </div>
      )}

      <div className="relative h-[68vh] max-h-[560px]">
        {/* Наступна картка — статичний фон, дає відчуття колоди. */}
        {next && (
          <SwipeCard
            listing={next}
            className="absolute inset-0 scale-[0.94] translate-y-3 opacity-80"
          />
        )}

        {/* Верхня — інтерактивна. */}
        <SwipeCard
          listing={top}
          photoIndex={photoIdx}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{
            transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`,
            transition: dragging ? "none" : "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
            touchAction: "none",
            cursor: dragging ? "grabbing" : "grab",
          }}
          className="absolute inset-0 z-10"
        >
          {/* Штампи рішення поверх фото. */}
          <div
            className="absolute top-6 left-5 z-20 rotate-[-16deg] border-4 border-brand-teal text-brand-teal font-display-lg text-[28px] px-3 py-1 rounded-lg pointer-events-none"
            style={{ opacity: likeOpacity }}
          >
            ПОДОБАЄТЬСЯ
          </div>
          <div
            className="absolute top-6 right-5 z-20 rotate-[16deg] border-4 border-error text-error font-display-lg text-[28px] px-3 py-1 rounded-lg pointer-events-none"
            style={{ opacity: nopeOpacity }}
          >
            ПРОПУСК
          </div>
        </SwipeCard>
      </div>

      {/* Кнопки — дублюють жест для тих, хто не свайпає. */}
      <div className="flex items-center justify-center gap-5 mt-6">
        <button
          onClick={() => commit("nope")}
          aria-label="Пропустити"
          className="w-14 h-14 rounded-full bg-surface-container-lowest border border-outline-variant/50 shadow-level-2 flex items-center justify-center text-error hover:scale-110 active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-[28px]">close</span>
        </button>
        <button
          onClick={undo}
          disabled={history.length === 0}
          aria-label="Повернути попередню"
          className="w-11 h-11 rounded-full bg-surface-container-lowest border border-outline-variant/50 shadow-sm flex items-center justify-center text-on-surface-variant hover:scale-110 active:scale-95 transition-transform disabled:opacity-30 disabled:hover:scale-100"
        >
          <span className="material-symbols-outlined text-[22px]">undo</span>
        </button>
        <button
          onClick={() => commit("like")}
          aria-label="У обране"
          className="w-14 h-14 rounded-full bg-brand-teal shadow-level-2 flex items-center justify-center text-on-secondary hover:scale-110 active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-[28px]">favorite</span>
        </button>
      </div>

      <p className="text-center font-caption text-caption text-on-surface-variant mt-4">
        Свайп вправо — в обране, вліво — пропустити. Тап по фото — наступне.
      </p>
    </div>
  );
}

// Пропси перелічені явно, а не через ...rest: спред довільних пропсів на
// div протікав нестандартним атрибутом (photoIndex) у DOM. Явний список —
// жоден зайвий атрибут не потрапить на елемент.
function SwipeCard({
  listing,
  photoIndex = 0,
  children,
  className = "",
  style,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  listing: Listing;
  /** Індекс активного фото — керується зовні (тап по половинах картки). */
  photoIndex?: number;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onPointerCancel?: (e: React.PointerEvent) => void;
}) {
  const photos = listing.photos ?? [];
  const idx = Math.min(photoIndex, Math.max(0, photos.length - 1));
  const photo = photos[idx];
  const location = [listing.city, listing.district].filter(Boolean).join(", ");
  const verified = listing.owner_verified === true;
  const isNoFee = listing.listing_type === "agency_no_fee";
  const tags: string[] = [];
  if (listing.rooms) tags.push(`${listing.rooms} кімн.`);
  if (listing.area_sqm) tags.push(`${listing.area_sqm} м²`);

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={style}
      className={`overflow-hidden rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-level-3 flex flex-col ${className}`}
    >
      <div className="relative flex-1 bg-surface-container">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="w-full h-full object-cover pointer-events-none" draggable={false} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-outline">
            <span className="material-symbols-outlined text-[48px]">apartment</span>
          </div>
        )}

        {/* Смужки-індикатори фото (Instagram Stories): скільки фото і яке
            зараз. Показуємо лише коли фото більше одного. */}
        {photos.length > 1 && (
          <div className="absolute top-2 inset-x-3 z-20 flex gap-1 pointer-events-none">
            {photos.map((_, i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i === idx ? "bg-white" : "bg-white/35"
                }`}
              />
            ))}
          </div>
        )}

        {/* Підказка «ще фото» — з'являється лише поки фото не гортали. */}
        {photos.length > 1 && idx === 0 && (
          <span className="absolute top-5 right-3 z-10 bg-on-surface/50 text-white font-caption text-caption px-2 py-0.5 rounded-full flex items-center gap-1 pointer-events-none">
            <span className="material-symbols-outlined text-[13px]">touch_app</span>
            {photos.length} фото
          </span>
        )}

        {/* Мітка джерела продавця. */}
        <div className={`absolute left-3 z-10 ${photos.length > 1 ? "top-7" : "top-3"}`}>
          <span
            className={`inline-flex items-center gap-1 backdrop-blur-sm px-2.5 py-1 rounded-full font-caption text-caption ${
              verified
                ? "bg-secondary-fixed text-on-secondary-fixed"
                : "bg-surface-container-lowest/85 text-on-surface-variant"
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {isNoFee ? "percent" : verified ? "verified" : "search"}
            </span>
            {isNoFee ? "0% комісії" : verified ? "Перевірений власник" : "Без ознак посередника"}
          </span>
        </div>

        {/* Градієнт знизу під текст. */}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-on-surface/85 to-transparent pointer-events-none" />

        <div className="absolute inset-x-0 bottom-0 p-5 text-white pointer-events-none">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="font-display-lg text-[26px]">{formatPrice(listing.price, listing.currency)}</span>
          </div>
          <p className="font-body-md text-body-md text-white/90 flex items-center gap-1 mb-2">
            <span className="material-symbols-outlined text-[18px]">location_on</span>
            {location || "—"}
          </p>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t} className="bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded font-caption text-caption">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
