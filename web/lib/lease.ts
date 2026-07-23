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
};

export type RentPayment = {
  id: string;
  /** Дата платежу, яку закривають ці гроші (не день натискання кнопки). */
  due_date: string;
  amount: number;
  paid_on: string;
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

/** Дата у вигляді YYYY-MM-DD у локальному календарі (не UTC). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Дата платежу за N місяців від заданої, з поправкою на короткі місяці. */
function shiftMonths(paymentDay: number, base: Date, months: number): Date {
  const y = base.getFullYear();
  const m = base.getMonth() + months;
  const lastDay = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(paymentDay, lastDay));
}

/**
 * Найближчий НЕОПЛАЧЕНИЙ платіж.
 *
 * Дозволяє платити наперед: коли поточний період закрито, показуємо наступний,
 * а не ховаємо віджет. Обмежуємо 24 місяцями, щоб не крутити цикл вічно.
 */
export function nextUnpaidDueDate(
  paymentDay: number,
  paidDueDates: Set<string>,
  from: Date = new Date()
): Date {
  const first = nextPaymentDate(paymentDay, from);
  for (let i = 0; i < 24; i++) {
    const candidate = shiftMonths(paymentDay, first, i);
    if (!paidDueDates.has(toISODate(candidate))) return candidate;
  }
  return first;
}

/**
 * Пропущені платежі: дати в минулому, за якими немає запису.
 *
 * Рахуємо від початку договору — інакше пропуск помічається лише тоді, коли
 * про нього вже пізно згадувати.
 */
export function missedDueDates(
  lease: Lease,
  paidDueDates: Set<string>,
  from: Date = new Date()
): string[] {
  const today = startOfDay(from);
  const start = parseDate(lease.lease_start_date);
  const missed: string[] = [];

  let cursor = nextPaymentDate(lease.payment_day, start);
  for (let i = 0; i < 240 && cursor < today; i++) {
    const iso = toISODate(cursor);
    if (!paidDueDates.has(iso)) missed.push(iso);
    cursor = shiftMonths(lease.payment_day, cursor, 1);
  }
  return missed;
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
