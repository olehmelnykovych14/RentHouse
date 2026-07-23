"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { moveCard, saveNote, archiveCard, type BoardColumn } from "@/app/dashboard/actions";

export type BoardCard = {
  listing_id: string;
  status: BoardColumn;
  personal_note: string | null;
  title: string | null;
  price: number | null;
  currency: string | null;
  city: string | null;
  district: string | null;
  photo: string | null;
  seller_contact: string | null;
};

const COLUMNS: { key: BoardColumn; label: string; accent: string }[] = [
  { key: "favorites", label: "Обране", accent: "bg-outline" },
  { key: "contacted", label: "Зв'язалися", accent: "bg-primary" },
  { key: "viewings_scheduled", label: "Перегляд призначено", accent: "bg-secondary" },
];

export default function SearchBoard({ cards }: { cards: BoardCard[] }) {
  // Локальна копія, щоб картка рухалась одразу, не чекаючи на сервер.
  const [items, setItems] = useState(cards);

  // …але щойно сервер віддає свіжі дані, головні — вони. Без цього useState
  // назавжди тримав би початковий знімок і розходився б з базою.
  const [syncedWith, setSyncedWith] = useState(cards);
  if (cards !== syncedWith) {
    setSyncedWith(cards);
    setItems(cards);
  }
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<BoardColumn | null>(null);
  const [, startTransition] = useTransition();

  function move(listingId: string, to: BoardColumn) {
    const before = items;
    setItems((prev) =>
      prev.map((c) => (c.listing_id === listingId ? { ...c, status: to } : c))
    );
    startTransition(async () => {
      const res = await moveCard(listingId, to);
      // Сервер відмовив — повертаємо як було, інакше екран показував би
      // переміщення, якого в базі не сталося.
      if (!res.ok) setItems(before);
    });
  }

  function remove(listingId: string) {
    const before = items;
    setItems((prev) => prev.filter((c) => c.listing_id !== listingId));
    startTransition(async () => {
      const res = await archiveCard(listingId);
      if (!res.ok) setItems(before);
    });
  }

  if (items.length === 0) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-12 text-center">
        <span className="material-symbols-outlined text-[40px] text-outline">bookmark_border</span>
        <h3 className="font-headline-md text-headline-md text-on-surface mt-3 mb-2">
          Дошка порожня
        </h3>
        <p className="font-body-md text-body-md text-on-surface-variant mb-6">
          Додавайте квартири в обране — вони з&apos;являться тут, і ви зможете вести їх
          від першого дзвінка до перегляду.
        </p>
        <Link
          href="/listings"
          className="inline-flex items-center gap-2 bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded-full hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-[18px]">search</span>
          До каталогу
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter items-start">
      {COLUMNS.map((col) => {
        const inColumn = items.filter((c) => c.status === col.key);
        return (
          <section
            key={col.key}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.key);
            }}
            onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              if (dragging) move(dragging, col.key);
              setDragging(null);
            }}
            className={`rounded-xl border p-3 transition-colors ${
              over === col.key
                ? "bg-primary/5 border-primary/40"
                : "bg-surface-container-low border-outline-variant/30"
            }`}
          >
            <header className="flex items-center gap-2 px-2 py-2 mb-1">
              <span className={`w-1.5 h-1.5 rounded-full ${col.accent}`} />
              <h2 className="font-label-md text-label-md text-on-surface">{col.label}</h2>
              <span className="ml-auto font-caption text-caption text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
                {inColumn.length}
              </span>
            </header>

            <div className="flex flex-col gap-3 min-h-[80px]">
              {inColumn.map((card) => (
                <Card
                  key={card.listing_id}
                  card={card}
                  onDragStart={() => setDragging(card.listing_id)}
                  onDragEnd={() => setDragging(null)}
                  onMove={(to) => move(card.listing_id, to)}
                  onArchive={() => remove(card.listing_id)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Card({
  card,
  onDragStart,
  onDragEnd,
  onMove,
  onArchive,
}: {
  card: BoardCard;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (to: BoardColumn) => void;
  onArchive: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(card.personal_note ?? "");
  const [saving, setSaving] = useState(false);
  const location = [card.city, card.district].filter(Boolean).join(", ");

  async function commit() {
    setEditing(false);
    if (note.trim() === (card.personal_note ?? "").trim()) return;
    setSaving(true);
    await saveNote(card.listing_id, note);
    setSaving(false);
  }

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="bg-surface-container-lowest border border-outline-variant/40 rounded-lg overflow-hidden shadow-sm hover:shadow-card-hover hover:-translate-y-0.5 transition-[transform,box-shadow] duration-250 ease-out-soft motion-safe:animate-fade-up cursor-grab active:cursor-grabbing active:rotate-1 active:scale-[0.98]"
    >
      {card.photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.photo} alt="" className="w-full h-24 object-cover" />
      )}

      <div className="p-3">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <span className="font-label-lg text-label-lg text-on-surface">
            {formatPrice(card.price, card.currency)}
          </span>
        </div>
        <Link
          href={`/listings/${card.listing_id}`}
          className="block font-body-sm text-body-sm text-on-surface-variant hover:text-primary truncate"
        >
          {card.title || location || "Оголошення"}
        </Link>

        {/* Особиста нотатка */}
        {editing ? (
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setNote(card.personal_note ?? "");
                setEditing(false);
              }
              // Enter зберігає, Shift+Enter лишає перенос рядка.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commit();
              }
            }}
            rows={2}
            placeholder="Ваша нотатка…"
            className="w-full mt-2 bg-surface-container-low border-l-[3px] border-brand-amber rounded-r-md p-2 font-body-sm text-body-sm text-on-surface resize-none focus:outline-none focus:bg-surface-container"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="w-full text-left mt-2 bg-surface-container-low border-l-[3px] border-brand-amber rounded-r-md p-2 font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container transition-colors duration-200 min-h-[38px]"
          >
            {saving ? "Збереження…" : note || <span className="text-outline">+ Нотатка</span>}
          </button>
        )}

        {/* Дії */}
        <div className="flex items-center gap-1 mt-2">
          {card.seller_contact ? (
            <a
              href={`tel:${card.seller_contact}`}
              title="Подзвонити"
              className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">call</span>
            </a>
          ) : (
            <span
              title="Контакт відкривається за підпискою"
              className="w-8 h-8 rounded flex items-center justify-center text-outline/40 cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">call</span>
            </span>
          )}
          <button
            onClick={() => setEditing(true)}
            title="Редагувати нотатку"
            className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">edit_note</span>
          </button>
          <button
            onClick={onArchive}
            title="Прибрати з дошки"
            className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:bg-error-container hover:text-error transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">archive</span>
          </button>

          {/* Запасний шлях до перетягування: воно недоступне з клавіатури
              й не працює на тач-екранах. */}
          <select
            value={card.status}
            onChange={(e) => onMove(e.target.value as BoardColumn)}
            aria-label="Перемістити в колонку"
            className="ml-auto bg-transparent border border-outline-variant/40 rounded font-caption text-caption text-on-surface-variant px-1.5 py-1 cursor-pointer focus:outline-none focus:border-primary"
          >
            <option value="favorites">Обране</option>
            <option value="contacted">Зв&apos;язалися</option>
            <option value="viewings_scheduled">Перегляд</option>
          </select>
        </div>
      </div>
    </article>
  );
}
