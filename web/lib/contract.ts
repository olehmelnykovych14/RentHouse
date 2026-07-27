/**
 * AI-перевірка договору оренди: спільні типи й обмеження для API та клієнта.
 * Аналіз завжди з позиції ОРЕНДАРЯ — що в договорі ризиковано саме для нього.
 */

export const ACCEPTED_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;
export const ACCEPTED_HINT = "PDF, JPG або PNG до 25 МБ";
export const MAX_SIZE_MB = 25;
export const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export type Severity = "high" | "medium";

export type RedFlag = {
  /** Номер пункту, якщо він є в тексті ("Пункт 3.2"); інакше порожньо. */
  clause: string;
  title: string;
  detail: string;
  severity: Severity;
};

export type SafeClause = {
  title: string;
  detail: string;
};

export type ContractReview = {
  is_rental_contract: boolean;
  document_type: string;
  /** Best-effort кількість сторінок; 0, якщо визначити не вдалося. */
  pages: number;
  summary: string;
  red_flags: RedFlag[];
  safe_clauses: SafeClause[];
};

/** Причина відмови у форматі, придатному для показу користувачу, або null. */
export function fileRejectReason(type: string, size: number): string | null {
  if (!ACCEPTED_MIME.includes(type as (typeof ACCEPTED_MIME)[number])) {
    return `Непідтримуваний формат. Прийнятні: ${ACCEPTED_HINT}`;
  }
  if (size > MAX_SIZE_BYTES) return `Файл завеликий — максимум ${MAX_SIZE_MB} МБ`;
  if (size === 0) return "Файл порожній";
  return null;
}
