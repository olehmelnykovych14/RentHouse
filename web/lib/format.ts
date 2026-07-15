const SYMBOLS: Record<string, string> = { UAH: "₴", USD: "$", EUR: "€" };

export function formatPrice(price: number | null, currency: string | null): string {
  if (price == null) return "Ціна не вказана";
  const symbol = SYMBOLS[currency ?? "UAH"] ?? "₴";
  const amount = new Intl.NumberFormat("uk-UA").format(price);
  return `${symbol} ${amount}`;
}
