"use client";

import { useState, useTransition } from "react";
import { formatPrice } from "@/lib/format";
import {
  daysUntilPayment,
  leaseCountdown,
  isCurrentPeriodPaid,
  nextPaymentDate,
  pluralDays,
  pluralMonths,
  type Lease,
} from "@/lib/lease";
import { markRentPaid, addUtilityBill, deleteUtilityBill } from "@/app/dashboard/actions";

export type UtilityBill = {
  id: string;
  title: string;
  amount: number;
  created_at: string;
};

export default function LeaseTracker({
  lease,
  bills,
}: {
  lease: Lease;
  bills: UtilityBill[];
}) {
  const [, startTransition] = useTransition();
  const [paid, setPaid] = useState(() => isCurrentPeriodPaid(lease));

  const days = daysUntilPayment(lease.payment_day);
  const countdown = leaseCountdown(lease);
  const nextDate = nextPaymentDate(lease.payment_day);

  function pay() {
    setPaid(true);
    startTransition(async () => {
      const res = await markRentPaid(lease.id);
      if (!res.ok) setPaid(false);
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
        </section>

        {/* Наступний платіж */}
        <section className="bg-primary text-on-primary rounded-xl p-6 text-center shadow-level-2">
          <p className="font-label-sm text-label-sm opacity-80 uppercase tracking-wider mb-4">
            Наступний платіж
          </p>
          <div className="w-28 h-28 mx-auto rounded-full border-4 border-on-primary/25 flex flex-col items-center justify-center mb-4">
            <span className="font-display-lg text-headline-lg leading-none">
              {paid ? "✓" : days}
            </span>
            {!paid && (
              <span className="font-caption text-caption opacity-80 mt-0.5">
                {days === 1 ? "день" : days >= 2 && days <= 4 ? "дні" : "днів"}
              </span>
            )}
          </div>
          <p className="font-body-sm text-body-sm opacity-80 mb-4">
            {paid
              ? "Оплачено за цей період"
              : days === 0
                ? `Платіж сьогодні — ${formatPrice(lease.rent_amount, "UAH")}`
                : `${formatPrice(lease.rent_amount, "UAH")} до ${nextDate.toLocaleDateString("uk-UA", { day: "numeric", month: "long" })}`}
          </p>
          <button
            onClick={pay}
            disabled={paid}
            className="w-full bg-on-primary text-primary font-label-md text-label-md py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-default"
          >
            {paid ? "Позначено оплаченим" : "Позначити оплаченим"}
          </button>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter items-start">
        {/* Комунальні */}
        <section className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="font-headline-sm text-title-lg text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                receipt_long
              </span>
              Комунальні платежі
            </h3>
            <AddBillButton leaseId={lease.id} />
          </div>

          {bills.length === 0 ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant py-6 text-center">
              Ще нічого не додано. Записуйте рахунки, щоб бачити, у скільки
              обходиться житло насправді.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        {/* Строк договору */}
        <section className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-6">
          <h3 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-3">
            Закінчення договору
          </h3>

          {countdown.expired ? (
            <p className="bg-error-container text-on-error-container font-body-sm text-body-sm rounded-lg px-3 py-2">
              Строк договору минув {new Date(lease.lease_end_date).toLocaleDateString("uk-UA")}.
            </p>
          ) : (
            <>
              <p className="font-headline-md text-headline-md text-on-surface mb-1">
                {countdown.months > 0 && `${pluralMonths(countdown.months)} `}
                {pluralDays(countdown.days)}
              </p>
              <p className="font-caption text-caption text-on-surface-variant mb-4">
                до {new Date(lease.lease_end_date).toLocaleDateString("uk-UA")}
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
        <span className="material-symbols-outlined text-[18px] text-on-tertiary-fixed">bolt</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-label-md text-label-md text-on-surface truncate">{bill.title}</p>
        <p className="font-caption text-caption text-on-surface-variant">
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

function AddBillButton({ leaseId }: { leaseId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);
    const res = await addUtilityBill(leaseId, formData);
    setBusy(false);
    if (res.ok) setOpen(false);
    else setError(res.error);
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
          {/* Клік поза формою закриває її */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <form
            action={submit}
            className="absolute right-0 top-full mt-2 z-20 w-64 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-3 p-4 space-y-3"
          >
            <input
              autoFocus
              name="title"
              required
              maxLength={80}
              placeholder="напр. Електрика за серпень"
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 font-body-sm text-body-sm text-on-surface placeholder-outline focus:outline-none focus:border-primary"
            />
            <input
              name="amount"
              type="number"
              required
              min={0}
              step="0.01"
              placeholder="Сума, ₴"
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 font-body-sm text-body-sm text-on-surface placeholder-outline focus:outline-none focus:border-primary"
            />
            {error && (
              <p className="font-caption text-caption text-error">{error}</p>
            )}
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
