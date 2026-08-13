/**
 * Міста, які покривають парсери (olx_monitor_1.py, dimria_monitor.py).
 * Тримаємо список тут, а не тягнемо з БД: він має бути стабільним навіть коли
 * в місті ще нема оголошень — інакше пошук «зникає» на порожній базі.
 */
export type City = {
  name: string;
  region: string;
  /** Латинські написання — люди часто друкують «lviv» замість «Львів». */
  aliases: string[];
};

export const CITIES: City[] = [
  { name: "Київ", region: "Київська область", aliases: ["kyiv", "kiev"] },
  { name: "Львів", region: "Львівська область", aliases: ["lviv", "lvov"] },
  { name: "Одеса", region: "Одеська область", aliases: ["odesa", "odessa"] },
  { name: "Дніпро", region: "Дніпропетровська область", aliases: ["dnipro"] },
  { name: "Харків", region: "Харківська область", aliases: ["kharkiv"] },
  { name: "Вінниця", region: "Вінницька область", aliases: ["vinnytsia"] },
  { name: "Тернопіль", region: "Тернопільська область", aliases: ["ternopil"] },
  { name: "Івано-Франківськ", region: "Івано-Франківська область", aliases: ["ivano", "frankivsk"] },
  { name: "Запоріжжя", region: "Запорізька область", aliases: ["zaporizhzhia"] },
  { name: "Полтава", region: "Полтавська область", aliases: ["poltava"] },
  { name: "Ужгород", region: "Закарпатська область", aliases: ["uzhhorod"] },
];

/**
 * Підказки за введеним рядком. Збіг на початку слова показуємо вище за збіг
 * усередині, щоб «пол» давало Полтаву раніше за Тернопіль.
 */
export function suggestCities(query: string, limit = 6): City[] {
  const q = query.trim().toLowerCase();
  if (!q) return CITIES.slice(0, limit);

  const scored = CITIES.map((city) => {
    const haystacks = [city.name.toLowerCase(), ...city.aliases];
    let score = -1;
    for (const h of haystacks) {
      if (h.startsWith(q)) score = Math.max(score, 2);
      else if (h.includes(q)) score = Math.max(score, 1);
    }
    return { city, score };
  }).filter((s) => s.score > 0);

  scored.sort((a, b) => b.score - a.score || a.city.name.localeCompare(b.city.name, "uk"));
  return scored.slice(0, limit).map((s) => s.city);
}
