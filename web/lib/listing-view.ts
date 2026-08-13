/**
 * Клієнт-безпечні хелпери відображення оголошень — БЕЗ серверних імпортів
 * (`lib/listings.ts` тягне supabase/server → next/headers, тож клієнтські
 * компоненти не можуть імпортувати рантайм звідти).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Чи заблоковане оголошення за paywall.
 * Свіжі (молодші 24 год) видно лише підписникам. Приймає будь-що з created_at,
 * щоб не тягнути повний тип Listing.
 */
export function isLocked(listing: { created_at: string | null }, subscribed = false): boolean {
  if (subscribed) return false;
  if (!listing.created_at) return false;
  return Date.now() - Date.parse(listing.created_at) < DAY_MS;
}
