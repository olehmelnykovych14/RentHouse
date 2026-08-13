/**
 * Перевірка розрахунків трекера оренди на крайніх випадках.
 * Запуск:  npx tsx lib/lease.test.mts
 */
import {
  nextPaymentDate,
  daysUntilPayment,
  leaseCountdown,
  nextUnpaidDueDate,
  missedDueDates,
  toISODate,
  pluralDays,
  pluralMonths,
  type Lease,
} from "./lease.js";

let passed = 0;
let failed = 0;

function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? passed++ : failed++;
  console.log(`${ok ? "OK  " : "FAIL"}  ${name}`);
  if (!ok) console.log(`        очікували ${JSON.stringify(want)}, отримали ${JSON.stringify(got)}`);
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ── Дата платежу ────────────────────────────────────────────────
check("платіж 15-го, сьогодні 3-тє → цього місяця",
  iso(nextPaymentDate(15, new Date(2026, 6, 3))), "2026-07-15");

check("платіж 15-го, сьогодні 20-те → наступного місяця",
  iso(nextPaymentDate(15, new Date(2026, 6, 20))), "2026-08-15");

check("платіж сьогодні → сьогодні, не наступного місяця",
  iso(nextPaymentDate(15, new Date(2026, 6, 15))), "2026-07-15");

// Головна пастка: 31-е число в місяцях, де його немає.
check("платіж 31-го, лютий → 28-ме (не 3 березня)",
  iso(nextPaymentDate(31, new Date(2026, 1, 5))), "2026-02-28");

check("платіж 31-го, високосний лютий → 29-те",
  iso(nextPaymentDate(31, new Date(2028, 1, 5))), "2028-02-29");

check("платіж 31-го, квітень (30 днів) → 30-те",
  iso(nextPaymentDate(31, new Date(2026, 3, 10))), "2026-04-30");

check("платіж 31-го грудня → перехід через Новий рік",
  iso(nextPaymentDate(31, new Date(2026, 11, 31))), "2026-12-31");

check("грудень, платіж 5-го, сьогодні 10-те → січень наступного року",
  iso(nextPaymentDate(5, new Date(2026, 11, 10))), "2027-01-05");

// ── Дні до платежу ──────────────────────────────────────────────
check("12 днів до платежу", daysUntilPayment(15, new Date(2026, 6, 3)), 12);
check("платіж сьогодні → 0", daysUntilPayment(15, new Date(2026, 6, 15)), 0);

// ── Строк договору ──────────────────────────────────────────────
const lease = (start: string, end: string, extra: Partial<Lease> = {}): Lease => ({
  id: "x", property_address: "тест", rent_amount: 12000, payment_day: 15,
  lease_start_date: start, lease_end_date: end, ...extra,
});

const c1 = leaseCountdown(lease("2026-01-01", "2026-12-31"), new Date(2026, 6, 1));
check("лишилось 5 місяців 30 днів", [c1.months, c1.days], [5, 30]);
check("минуло ~50% строку", Math.round(c1.elapsedRatio * 100), 50);

const c2 = leaseCountdown(lease("2026-01-01", "2026-06-01"), new Date(2026, 8, 1));
check("прострочений договір", [c2.expired, c2.elapsedRatio], [true, 1]);

const c3 = leaseCountdown(lease("2026-01-31", "2026-02-28"), new Date(2026, 0, 31));
check("календарний місяць від 31 січня", [c3.months, c3.days], [0, 28]);

// ── Історія платежів ────────────────────────────────────────────
const now = new Date(2026, 6, 3); // 3 липня 2026, платіж 15-го

check("нічого не оплачено → найближчий платіж поточного місяця",
  toISODate(nextUnpaidDueDate(15, new Set(), now)), "2026-07-15");

check("поточний оплачено → показуємо наступний",
  toISODate(nextUnpaidDueDate(15, new Set(["2026-07-15"]), now)), "2026-08-15");

check("оплата наперед на два місяці",
  toISODate(nextUnpaidDueDate(15, new Set(["2026-07-15", "2026-08-15"]), now)), "2026-09-15");

check("оплата наперед через короткий місяць (платіж 31-го)",
  toISODate(nextUnpaidDueDate(31, new Set(["2026-07-31"]), now)), "2026-08-31");

check("пропущені платежі від початку договору",
  missedDueDates(lease("2026-01-01", "2026-12-31"), new Set(["2026-03-15", "2026-05-15"]), now),
  ["2026-01-15", "2026-02-15", "2026-04-15", "2026-06-15"]);

check("усе сплачено → пропусків немає",
  missedDueDates(lease("2026-05-01", "2026-12-31"),
    new Set(["2026-05-15", "2026-06-15"]), now), []);

check("майбутні платежі не рахуються пропущеними",
  missedDueDates(lease("2026-06-01", "2026-12-31"), new Set(["2026-06-15"]), now), []);

// ── Українські форми множини ────────────────────────────────────
check("1 день", pluralDays(1), "1 день");
check("2 дні", pluralDays(2), "2 дні");
check("5 днів", pluralDays(5), "5 днів");
check("11 днів (не «11 день»)", pluralDays(11), "11 днів");
check("21 день", pluralDays(21), "21 день");
check("12 днів", pluralDays(12), "12 днів");
check("1 місяць", pluralMonths(1), "1 місяць");
check("3 місяці", pluralMonths(3), "3 місяці");
check("11 місяців", pluralMonths(11), "11 місяців");

console.log(`\nпройдено ${passed}, провалено ${failed}`);
process.exit(failed ? 1 : 0);
