const SYMBOLS: Record<string, string> = { UAH: "₴", USD: "$", EUR: "€" };

export function formatPrice(price: number | null, currency: string | null): string {
  if (price == null) return "Ціна не вказана";
  const symbol = SYMBOLS[currency ?? "UAH"] ?? "₴";
  const amount = new Intl.NumberFormat("uk-UA").format(price);
  return `${symbol} ${amount}`;
}

/** «Свіжість» оголошення людською мовою: сьогодні / вчора / N дн. / N тиж. тому. */
export function relativeDate(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days <= 0) return "сьогодні";
  if (days === 1) return "вчора";
  if (days < 7) return `${days} дн. тому`;
  if (days < 30) return `${Math.floor(days / 7)} тиж. тому`;
  if (days < 365) return `${Math.floor(days / 30)} міс. тому`;
  return `${Math.floor(days / 365)} р. тому`;
}

/**
 * Читабельний заголовок оголошення. Скрапер кладе в `title` перші ~120 символів
 * тексту поста, тож він обривається посеред слова («…відкривається в»). Перший
 * непорожній рядок — це і є справжня назва; повний текст лишається в описі.
 */
export function listingTitle(
  title?: string | null,
  fallback?: string | null,
  max = 80
): string {
  const raw = (title && title.trim()) || (fallback && fallback.trim()) || "";
  if (!raw) return "Квартира";
  const firstLine = raw.split(/\r?\n/).map((s) => s.trim()).find(Boolean) ?? raw;
  if (firstLine.length <= max) return firstLine;
  const cut = firstLine.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  // Ріжемо по межі слова й прибираємо «хвіст» пунктуації перед трикрапкою.
  return (sp > 40 ? cut.slice(0, sp) : cut).replace(/[\s—|,:;-]+$/, "") + "…";
}
