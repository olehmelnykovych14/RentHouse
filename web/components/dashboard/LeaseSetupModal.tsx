"use client";

import { useEffect, useRef, useState } from "react";
import { createLease } from "@/app/dashboard/actions";

export default function LeaseSetupModal({
  open,
  onClose,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  /** false — коли оренди ще немає: закривати нічого. */
  dismissible?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, dismissible]);

  if (!open) return null;

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);
    const res = await createLease(formData);
    setBusy(false);
    if (res.ok) onClose();
    else setError(res.error);
  }

  // Дата за замовчуванням — рік від сьогодні, найтиповіший строк.
  const inOneYear = new Date();
  inOneYear.setFullYear(inOneYear.getFullYear() + 1);
  const defaultEnd = inOneYear.toISOString().slice(0, 10);

  return (
    <div
      className="fixed inset-0 z-[100] bg-on-surface/40 backdrop-blur-sm flex items-center justify-center p-4 motion-safe:animate-fade-in"
      onClick={() => dismissible && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lease-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-container-lowest rounded-2xl shadow-level-3 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto motion-safe:animate-scale-in"
      >
        <div className="flex items-start justify-between gap-4 mb-1">
          <h2
            id="lease-modal-title"
            className="font-headline-md text-headline-md text-on-surface"
          >
            Налаштуйте трекер оренди
          </h2>
          {dismissible && (
            <button
              onClick={onClose}
              aria-label="Закрити"
              className="text-on-surface-variant hover:text-on-surface shrink-0"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-6">
          Нагадаємо про платіж і покажемо, скільки лишилось до кінця договору.
        </p>

        <form action={submit} className="space-y-4">
          <Field label="Адреса помешкання">
            <input
              ref={firstField}
              name="property_address"
              required
              maxLength={200}
              placeholder="напр. вул. Стрийська 45, кв. 12"
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder-outline focus:outline-none focus:border-primary"
            />
          </Field>

          <Field label="Щомісячна оренда (₴)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-body-md text-body-md">
                ₴
              </span>
              <input
                name="rent_amount"
                type="number"
                required
                min={0}
                step={100}
                placeholder="12 000"
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg pl-8 pr-3 py-2.5 font-body-md text-body-md text-on-surface placeholder-outline focus:outline-none focus:border-primary"
              />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="День платежу">
              <select
                name="payment_day"
                required
                defaultValue="1"
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d} числа
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Договір діє до">
              <input
                name="lease_end_date"
                type="date"
                required
                defaultValue={defaultEnd}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary"
              />
            </Field>
          </div>

          <p className="font-caption text-caption text-on-surface-variant">
            Якщо в місяці немає обраного числа (напр. 31-го в лютому), платіж
            припадає на останній день місяця.
          </p>

          {error && (
            <p className="bg-error-container text-on-error-container font-body-sm text-body-sm rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-brand-blue text-on-primary font-label-md text-label-md py-3 rounded-lg hover:brightness-110 active:scale-[0.98] transition-[filter,transform] duration-200 disabled:opacity-50"
          >
            {busy ? "Збереження…" : "Зберегти оренду"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block font-label-sm text-label-sm text-on-surface-variant mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
