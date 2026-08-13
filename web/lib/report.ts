/**
 * Константи скарг — окремо від server action: у модулі з "use server" КОЖЕН
 * експорт мусить бути async-функцією, тож експортований звідти масив
 * перетворюється на серверне посилання й падає на клієнті (.map is not a
 * function). Тримаємо дані тут, дію — в report-actions.ts.
 */
export const REPORT_REASONS = [
  { value: "rented", label: "Квартиру вже здано" },
  { value: "agent", label: "Це посередник / ріелтор" },
  { value: "scam", label: "Схоже на шахрайство" },
  { value: "wrong", label: "Неправильні дані" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

/** Скільки скарг «вже здано» знімають оголошення автоматично. */
export const AUTO_EXPIRE_AT = 2;
