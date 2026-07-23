"use client";

import { useState, useTransition } from "react";
import { formatPrice } from "@/lib/format";
import {
  daysBetween,
  leaseCountdown,
  nextUnpaidDueDate,
  missedDueDates,
  parseDate,
  toISODate,
  pluralDays,
  pluralMonths,
  type Lease,
  type RentPayment,
} from "@/lib/lease";
import {
  UTILITY_CATEGORIES,
  categoryIcon,
  categoryLabel,
} from "@/lib/utilities";
import {
  markRentPaid,
  undoRentPayment,
  addUtilityBill,
  deleteUtilityBill,
} from "@/app/dashboard/actions";

export type UtilityBill = {
  id: string;
  title: string;
  amount: number;
  category: string | null;
  created_at: string;
};

const fmtDate = (iso: string) =>
  parseDate(iso).toLocaleDateString("uk-UA", { day: "numeric", month: "long" });

export default function LeaseTracker({
  lease,
  payments,
  bills,
}: {
  lease: Lease;
  payments: RentPayment[];
  bills: UtilityBill[];
}) {
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState(payments);

  // Після серверної дії revalidatePath віддає свіжі рядки в props, але
  // useState ініціалізується лише раз і про них не дізнається. Через це на
  // екрані назавжди лишались тимчасові записи з несправжніми id — і все,
  // що на них спиралось, працювало вхолосту. Сервер тут головний.
  const [syncedWith, setSyncedWith] = useState(payments);
  if (payments !== syncedWith) {
    setSyncedWith(payments);
    setRows(payments);
  }

  const paidSet = new Set(rows.map((p) => p.due_date));
  const dueDate = nextUnpaidDueDate(lease.payment_day, paidSet);
  const dueIso = toISODate(dueDate);
  const days = daysBetween(new Date(), dueDate);
  const missed = missedDueDates(lease, paidSet);
  const countdown = leaseCountdown(lease);

  function pay(iso: string) {
    const optimistic: RentPayment = {
      id: `pending-${iso}`,
      due_date: iso,
      amount: lease.rent_amount,
      paid_on: toISODate(new Date()),
    };
    setRows((prev) => [optimistic, ...prev]);
    startTransition(async () => {
      const res = await markRentPaid(lease.id, iso);
      if (!res.ok) setRows((prev) => prev.filter((p) => p.id !== optimistic.id));
    });
  }

  function undo(dueIso: string) {
    const before = rows;
    setRows((prev) => prev.filter((p) => p.due_date !== dueIso));
    startTransition(async () => {
      const res = await undoRentPayment(lease.id, dueIso);
      if (!res.ok) setRows(before);
    });
  }

  return (
    <div className="space-y-gutter">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter items-start">
        {/* Помешкання */}
        <section className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-6">
          <span className="inline-flex items-center gap-1.5 bg-secondary/10 text-secondary font-caption text-caption uppercase tracking-wider px-2 py-1 rounded mb-4">
            <span className="material-symbols-outlined text-[14px]">home</span>
            Поточне помешкання
          </span>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-1">
            {lease.property_address}
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Оренда {formatPrice(lease.rent_amount, "UAH")} на місяць, платіж{" "}
            {lease.payment_day} числа
          </p>

          {missed.length > 0 && (
            <div className="mt-4 bg-error-container text-on-error-container rounded-lg p-3">
              <p className="font-label-md text-label-md mb-2">
                Не позначено як оплачені: {missed.length}
              </p>
              <div className="flex flex-wrap gap-2">
                {missed.map((iso) => (
                  <button
                    key={iso}
                    onClick={() => pay(iso)}
                    className="bg-surface-container-lowest text-on-surface font-caption text-caption px-2.5 py-1 rounded-full hover:opacity-80 transition-opacity"
                  >
                    {parseDate(iso).toLocaleDateString("uk-UA", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {" — оплатити"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Наступний платіж */}
        <section className="bg-primary text-on-primary rounded-xl p-6 text-center shadow-level-2">
          <p className="font-label-sm text-label-sm opacity-80 uppercase tracking-wider mb-4">
            Наступний платіж
          </p>
          <div className="w-28 h-28 mx-auto rounded-full border-4 border-on-primary/25 flex flex-col items-center justify-center mb-4">
            <span className="font-display-lg text-headline-lg leading-none">{days}</span>
            <span className="font-caption text-caption opacity-80 mt-0.5">
              {days === 1 ? "день" : days >= 2 && days <= 4 ? "дні" : "днів"}
            </span>
          </div>
          <p className="font-body-sm text-body-sm opacity-80 mb-4">
            {formatPrice(lease.rent_amount, "UAH")} до {fmtDate(dueIso)}
          </p>
          <button
            onClick={() => pay(dueIso)}
            className="w-full bg-on-primary text-primary font-label-md text-label-md py-2.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            {days > 25 ? "Оплатити наперед" : "Позначити оплаченим"}
          </button>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter items-start">
        {/* Історія платежів */}
        <section className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-6">
          <h3 className="font-headline-sm text-title-lg text-on-surface flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
              history
            </span>
            Історія платежів
          </h3>

          {rows.length === 0 ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant py-6 text-center">
              Тут з&apos;являться всі оплати оренди — буде видно, за які місяці
              сплачено, а які пропущені.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-outline-variant/30">
                {rows.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-3 group">
                    <span className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px] text-secondary">
                        check
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-label-md text-label-md text-on-surface">
                        Оренда за{" "}
                        {parseDate(p.due_date).toLocaleDateString("uk-UA", {
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                      <p className="font-caption text-caption text-on-surface-variant">
                        сплачено {parseDate(p.paid_on).toLocaleDateString("uk-UA")}
                        {parseDate(p.paid_on) > parseDate(p.due_date) && (
                          <span className="text-error"> · із запізненням</span>
                        )}
                      </p>
                    </div>
                    <span className="font-label-lg text-label-lg text-on-surface shrink-0">
                      {formatPrice(Number(p.amount), "UAH")}
                    </span>
                    <button
                      onClick={() => undo(p.due_date)}
                      aria-label="Скасувати позначку"
                      title="Скасувати позначку"
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-on-surface-variant hover:text-error transition-opacity shrink-0"
                    >
                      <span className="material-symbols-outlined text-[18px]">undo</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex items-baseline justify-between mt-4 pt-4 border-t border-outline-variant/30">
                <span className="font-label-md text-label-md text-on-surface-variant">
                  Сплачено за оренду
                </span>
                <span className="font-headline-sm text-title-lg text-on-surface">
                  {formatPrice(
                    rows.reduce((s, p) => s + Number(p.amount), 0),
                    "UAH"
                  )}
                </span>
              </div>
            </>
          )}
        </section>

        {/* Строк договору */}
        <section className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-6">
          <h3 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-3">
            Закінчення договору
          </h3>

          {countdown.expired ? (
            <p className="bg-error-container text-on-error-container font-body-sm text-body-sm rounded-lg px-3 py-2">
              Строк договору минув {parseDate(lease.lease_end_date).toLocaleDateString("uk-UA")}.
            </p>
          ) : (
            <>
              <p className="font-headline-md text-headline-md text-on-surface mb-1">
                {countdown.months > 0 && `${pluralMonths(countdown.months)} `}
                {pluralDays(countdown.days)}
              </p>
              <p className="font-caption text-caption text-on-surface-variant mb-4">
                до {parseDate(lease.lease_end_date).toLocaleDateString("uk-UA")}
              </p>

              <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    countdown.totalDays <= 60 ? "bg-error" : "bg-secondary"
                  }`}
                  style={{ width: `${Math.round(countdown.elapsedRatio * 100)}%` }}
                />
              </div>
              <p className="font-caption text-caption text-on-surface-variant mt-2">
                Минуло {Math.round(countdown.elapsedRatio * 100)}% строку
              </p>

              {countdown.totalDays <= 60 && (
                <p className="mt-3 font-body-sm text-body-sm text-error">
                  Час говорити про продовження або шукати нове житло.
                </p>
              )}
            </>
          )}
        </section>
      </div>

      {/* Комунальні */}
      <section className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="font-headline-sm text-title-lg text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
              receipt_long
            </span>
            Комунальні платежі
          </h3>
          <AddBillButton leaseId={lease.id} knownTitles={bills} />
        </div>

        {bills.length === 0 ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant py-6 text-center">
            Ще нічого не додано. Записуйте рахунки, щоб бачити, у скільки
            обходиться житло насправді.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {bills.map((b) => (
                <BillCard key={b.id} bill={b} />
              ))}
            </div>
            <div className="flex items-baseline justify-between mt-4 pt-4 border-t border-outline-variant/30">
              <span className="font-label-md text-label-md text-on-surface-variant">
                Разом комунальних
              </span>
              <span className="font-headline-sm text-title-lg text-on-surface">
                {formatPrice(
                  bills.reduce((s, b) => s + Number(b.amount), 0),
                  "UAH"
                )}
              </span>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function BillCard({ bill }: { bill: UtilityBill }) {
  const [, startTransition] = useTransition();
  const [removed, setRemoved] = useState(false);
  if (removed) return null;

  return (
    <div className="flex items-center gap-3 bg-surface-container-low border border-outline-variant/30 rounded-lg p-3 group">
      <span className="w-9 h-9 rounded-full bg-tertiary-fixed flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-[18px] text-on-tertiary-fixed">
          {categoryIcon(bill.category)}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-label-md text-label-md text-on-surface truncate">{bill.title}</p>
        <p className="font-caption text-caption text-on-surface-variant truncate">
          {categoryLabel(bill.category) ?? "Інше"} ·{" "}
          {new Date(bill.created_at).toLocaleDateString("uk-UA")}
        </p>
      </div>
      <span className="font-label-lg text-label-lg text-on-surface shrink-0">
        {formatPrice(Number(bill.amount), "UAH")}
      </span>
      <button
        onClick={() => {
          setRemoved(true);
          startTransition(async () => {
            const res = await deleteUtilityBill(bill.id);
            if (!res.ok) setRemoved(false);
          });
        }}
        aria-label="Видалити"
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-on-surface-variant hover:text-error transition-opacity shrink-0"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}

const CUSTOM = "__custom__";

function AddBillButton({
  leaseId,
  knownTitles,
}: {
  leaseId: string;
  knownTitles: UtilityBill[];
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<string>(UTILITY_CATEGORIES[0].key);

  // Власні назви, які користувач уже вводив, — щоб не набирати їх щомісяця
  // заново. Це і є «зберігається на наступний раз».
  const customTitles = Array.from(
    new Set(knownTitles.filter((b) => !b.category).map((b) => b.title))
  ).slice(0, 8);

  const isCustom = choice === CUSTOM;
  const preset = UTILITY_CATEGORIES.find((c) => c.key === choice);

  async function submit(formData: FormData) {
    // Для готової категорії назва = її підпис, для власної — те, що ввели.
    if (!isCustom && preset) {
      formData.set("title", preset.label);
      formData.set("category", preset.key);
    } else {
      formData.set("category", "");
    }
    setBusy(true);
    setError(null);
    const res = await addUtilityBill(leaseId, formData);
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      setChoice(UTILITY_CATEGORIES[0].key);
    } else setError(res.error);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 bg-surface-container text-on-surface font-label-sm text-label-sm px-3 py-1.5 rounded-full hover:bg-surface-variant transition-colors"
      >
        <span className="material-symbols-outlined text-[16px]">add</span>
        Додати рахунок
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <form
            action={submit}
            className="absolute right-0 top-full mt-2 z-20 w-72 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-3 p-4 space-y-3"
          >
            <label className="block">
              <span className="block font-label-sm text-label-sm text-on-surface-variant mb-1.5">
                За що платіж
              </span>
              <select
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 font-body-sm text-body-sm text-on-surface focus:outline-none focus:border-primary"
              >
                {UTILITY_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
                {customTitles.length > 0 && (
                  <optgroup label="Ваші попередні">
                    {customTitles.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </optgroup>
                )}
                <option value={CUSTOM}>Інше — вписати свою назву…</option>
              </select>
            </label>

            {isCustom && (
              <input
                autoFocus
                name="title"
                required
                maxLength={80}
                placeholder="напр. Ремонт бойлера"
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 font-body-sm text-body-sm text-on-surface placeholder-outline focus:outline-none focus:border-primary"
              />
            )}
            {/* Обрана попередня назва — теж без категорії, тож передаємо як є. */}
            {!isCustom && !preset && <input type="hidden" name="title" value={choice} />}

            <input
              name="amount"
              type="number"
              required
              min={0}
              step="0.01"
              placeholder="Сума, ₴"
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 font-body-sm text-body-sm text-on-surface placeholder-outline focus:outline-none focus:border-primary"
            />

            {error && <p className="font-caption text-caption text-error">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-primary text-on-primary font-label-sm text-label-sm py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {busy ? "Додаємо…" : "Додати"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
