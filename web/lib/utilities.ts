/**
 * Категорії комунальних платежів.
 *
 * Список закритий навмисно: якщо кожен вводить назву руками, «Електрика»,
 * «електрика» і «ел-ка» стають трьома різними рахунками, і підсумки по
 * категорії порахувати вже не можна. Свою назву додати можна — вона
 * зберігається і наступного разу з'являється у списку.
 */

export type UtilityCategory = {
  key: string;
  label: string;
  icon: string;
};

export const UTILITY_CATEGORIES: UtilityCategory[] = [
  { key: "electricity", label: "Електроенергія", icon: "bolt" },
  { key: "gas", label: "Газ", icon: "local_fire_department" },
  { key: "water", label: "Вода", icon: "water_drop" },
  { key: "heating", label: "Опалення", icon: "thermostat" },
  { key: "osbb", label: "ОСББ / утримання", icon: "apartment" },
  { key: "internet", label: "Інтернет", icon: "wifi" },
  { key: "garbage", label: "Вивіз сміття", icon: "delete" },
  { key: "parking", label: "Паркомісце", icon: "local_parking" },
];

const BY_KEY = new Map(UTILITY_CATEGORIES.map((c) => [c.key, c]));

/** Іконка категорії; для власних назв — нейтральний чек. */
export function categoryIcon(category: string | null): string {
  return (category && BY_KEY.get(category)?.icon) || "receipt";
}

export function categoryLabel(category: string | null): string | null {
  return (category && BY_KEY.get(category)?.label) || null;
}

export function isPreset(category: string | null): boolean {
  return !!category && BY_KEY.has(category);
}
