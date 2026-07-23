/**
 * Розрахунки для трекера оренди.
 *
 * Усе рахуємо в локальних календарних днях, а не в мілісекундах: різниця
 * діленням на 86 400 000 дає 0 замість 1 для «завтра о 01:00» і ламається
 * на переході з зимового часу.
 */

export type Lease = {
  id: string;
  property_address: string;
  rent_amount: number;
  payment_day: number;
  lease_start_date: string;
  lease_end_date: string;
  last_paid_on: string | null;
};

/** Опівніч цієї дати — щоб порівнювати дні, а не моменти часу. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Різниця в календарних днях (b − a). */
export function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Найближча дата платежу.
 *
 * Якщо в місяці немає такого числа (30-е лютого), беремо останній день місяця —
 * інакше `new Date(2026, 1, 30)` мовчки перекидається на 2 березня.
 */
export function nextPaymentDate(paymentDay: number, from: Date = new Date()): Date {
  const today = startOfDay(from);

  const inMonth = (year: number, month: number) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(paymentDay, lastDay));
  };

  const thisMonth = inMonth(today.getFullYear(), today.getMonth());
  if (thisMonth >= today) return thisMonth;
  return inMonth(today.getFullYear(), today.getMonth() + 1);
}

/** Скільки днів лишилось до платежу. 0 — платити сьогодні. */
export function daysUntilPayment(paymentDay: number, from: Date = new Date()): number {
  return daysBetween(from, nextPaymentDate(paymentDay, from));
}

/**
 * Чи оплачено поточний період.
 *
 * Вважаємо оплаченим, якщо позначку поставлено після попередньої дати платежу:
 * тоді до наступної нічого не винні.
 */
export function isCurrentPeriodPaid(lease: Lease, from: Date = new Date()): boolean {
  if (!lease.last_paid_on) return false;
  const next = nextPaymentDate(lease.payment_day, from);
  const prev = new Date(next.getFullYear(), next.getMonth() - 1, next.getDate());
  return parseDate(lease.last_paid_on) >= startOfDay(prev);
}

export type LeaseCountdown = {
  months: number;
  days: number;
  totalDays: number;
  /** Частка строку, що вже минула, 0..1 — для смужки прогресу. */
  elapsedRatio: number;
  expired: boolean;
};

/** Скільки лишилось до кінця договору + скільки строку вже минуло. */
export function leaseCountdown(lease: Lease, from: Date = new Date()): LeaseCountdown {
  const today = startOfDay(from);
  const end = parseDate(lease.lease_end_date);
  const start = parseDate(lease.lease_start_date);

  const totalDays = Math.max(0, daysBetween(today, end));
  if (totalDays === 0 && end < today) {
    return { months: 0, days: 0, totalDays: 0, elapsedRatio: 1, expired: true };
  }

  // Місяці рахуємо календарно: «1 місяць» від 31 січня — це 28 лютого,
  // а не 30 днів.
  let months = 0;
  const cursor = new Date(today);
  while (true) {
    const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
    if (nextMonth > end) break;
    cursor.setTime(nextMonth.getTime());
    months += 1;
  }
  const days = daysBetween(cursor, end);

  const wholeSpan = daysBetween(start, end);
  const elapsed = daysBetween(start, today);
  const elapsedRatio = wholeSpan > 0 ? Math.min(1, Math.max(0, elapsed / wholeSpan)) : 1;

  return { months, days, totalDays, elapsedRatio, expired: false };
}

/** «12 днів», «1 день», «22 дні» — українські форми множини. */
export function pluralDays(n: number): string {
  const abs = Math.abs(n);
  const tens = abs % 100;
  const ones = abs % 10;
  if (tens >= 11 && tens <= 14) return `${n} днів`;
  if (ones === 1) return `${n} день`;
  if (ones >= 2 && ones <= 4) return `${n} дні`;
  return `${n} днів`;
}

export function pluralMonths(n: number): string {
  const abs = Math.abs(n);
  const tens = abs % 100;
  const ones = abs % 10;
  if (tens >= 11 && tens <= 14) return `${n} місяців`;
  if (ones === 1) return `${n} місяць`;
  if (ones >= 2 && ones <= 4) return `${n} місяці`;
  return `${n} місяців`;
}
