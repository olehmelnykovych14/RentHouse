"use client";

import { useState } from "react";
import { reportListing } from "@/app/listings/report-actions";
import { REPORT_REASONS, type ReportReason } from "@/lib/report";

/**
 * «Поскаржитись» на оголошення. Тримаємо стримано (текстове посилання, не
 * помітна кнопка): це запобіжник, а не заклик до дії.
 */
export default function ReportButton({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(reason: ReportReason) {
    setBusy(true);
    setError(null);
    const res = await reportListing(listingId, reason);
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      setDone(
        res.expired
          ? "Дякуємо! Оголошення знято з каталогу."
          : "Дякуємо — ми перевіримо це оголошення."
      );
    } else {
      setError(res.error);
    }
  }

  if (done) {
    return (
      <p className="font-caption text-caption text-secondary flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[16px]">check_circle</span>
        {done}
      </p>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="font-caption text-caption text-on-surface-variant hover:text-error transition-colors flex items-center gap-1.5"
      >
        <span className="material-symbols-outlined text-[16px]">flag</span>
        Поскаржитись на оголошення
      </button>

      {open && (
        <div className="absolute z-30 bottom-full mb-2 left-0 w-72 bg-surface-container-lowest border border-surface-variant rounded-xl shadow-level-2 p-3">
          <p className="font-label-sm text-label-sm text-on-surface-variant mb-2">
            Що не так із цим оголошенням?
          </p>
          <div className="flex flex-col">
            {REPORT_REASONS.map((r) => (
              <button
                key={r.value}
                onClick={() => send(r.value)}
                disabled={busy}
                className="text-left px-2 py-2 rounded-lg font-body-sm text-body-sm text-on-surface hover:bg-surface-container-high disabled:opacity-50 transition-colors"
              >
                {r.label}
              </button>
            ))}
          </div>
          {error && (
            <p className="mt-2 font-caption text-caption text-error">{error}</p>
          )}
          <button
            onClick={() => setOpen(false)}
            className="mt-1 w-full text-center font-caption text-caption text-on-surface-variant hover:text-on-surface py-1"
          >
            Скасувати
          </button>
        </div>
      )}
    </div>
  );
}
