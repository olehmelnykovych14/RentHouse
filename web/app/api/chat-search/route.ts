import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Listing } from "@/lib/listings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELECT =
  "id,title,price,currency,price_uah,rooms,district,city,area_sqm,clean_description,listing_type,photos,created_at";

// Інструмент, який AI викликає, витягнувши параметри з природного запиту.
const searchTool = {
  type: "function" as const,
  function: {
    name: "search_listings",
    description:
      "Пошук орендних квартир від власників за параметрами, які треба витягнути з тексту користувача (українською).",
    parameters: {
      type: "object",
      properties: {
        district: { type: "string", description: "Район або мікрорайон, напр. 'Франківський', 'Сихів', 'Личаківський'" },
        min_price: { type: "integer", description: "Мінімальна ціна за місяць" },
        max_price: { type: "integer", description: "Максимальна ціна за місяць" },
        rooms: { type: "integer", description: "Кількість кімнат" },
        pets_allowed: { type: "boolean", description: "Чи можна з тваринами" },
        furnished: { type: "boolean", description: "Чи з меблями" },
        sort: { type: "string", enum: ["cheapest", "newest"], description: "cheapest — найдешевші; newest — найновіші" },
      },
    },
  },
};

type Args = {
  district?: string;
  min_price?: number;
  max_price?: number;
  rooms?: number;
  pets_allowed?: boolean;
  furnished?: boolean;
  sort?: "cheapest" | "newest";
};

// Користувач каже "на Сихівському", дані містять "Сихів". Матчимо за коренем:
// прибираємо прикметникові/локативні закінчення й шукаємо підрядок.
function districtStem(d: string): string {
  const s = d.trim();
  const suffixes = ["івському", "ському", "цькому", "івський", "ський", "цький", "ому", "ім"];
  for (const suf of suffixes) {
    if (s.length - suf.length >= 4 && s.toLowerCase().endsWith(suf)) {
      return s.slice(0, s.length - suf.length);
    }
  }
  return s;
}

// Детермінований fallback: gpt-4o-mini часто пропускає кімнати/район у коротких
// запитах. Витягуємо їх регулярками і доповнюємо те, що AI не заповнив.
function heuristicArgs(message: string): Partial<Args> {
  const m = message.toLowerCase();
  const out: Partial<Args> = {};

  if (/(одно|однушк|студі|1[\s-]?к|1-к)/.test(m)) out.rooms = 1;
  else if (/(дво|двох|2[\s-]?к|2-к)/.test(m)) out.rooms = 2;
  else if (/(трьох|три[\s-]?к|3[\s-]?к|3-к)/.test(m)) out.rooms = 3;

  const districts: [RegExp, string][] = [
    [/сих/, "Сихів"], [/франк/, "Франків"], [/личак/, "Личаків"],
    [/кульпарк/, "Кульпарків"], [/центр/, "Центр"], [/вульк/, "Вульк"],
    [/кривч/, "Кривч"], [/південн/, "Південн"], [/новий львів|новому львов/, "Новий Львів"],
  ];
  for (const [re, name] of districts) if (re.test(m)) { out.district = name; break; }

  if (/(тварин|котик|кіт|кот|собак|пес|песик)/.test(m)) out.pets_allowed = true;
  return out;
}

async function runSearch(args: Args): Promise<Listing[]> {
  const supabase = createSupabaseServer();
  if (!supabase) return [];

  let q = supabase.from("listings_public").select(SELECT).eq("listing_type", "owner");

  if (args.district) q = q.ilike("district", `%${districtStem(args.district)}%`);
  if (typeof args.min_price === "number") q = q.gte("price_uah", args.min_price);
  if (typeof args.max_price === "number") q = q.lte("price_uah", args.max_price);
  if (typeof args.rooms === "number") q = q.eq("rooms", args.rooms);
  if (args.furnished === true) q = q.eq("has_furniture", true);
  // Немає колонки pets_allowed → шукаємо ознаки в описі (best-effort).
  if (args.pets_allowed === true) {
    q = q.or(
      "clean_description.ilike.%тварин%,clean_description.ilike.%кіт%,clean_description.ilike.%собак%,clean_description.ilike.%pet%"
    );
  }

  q = args.sort === "cheapest"
    ? q.order("price_uah", { ascending: true })
    : q.order("created_at", { ascending: false });

  const { data, error } = await q.limit(8);
  if (error) {
    console.error("[chat-search] supabase:", error.message);
    return [];
  }
  return (data as unknown as Listing[]) ?? [];
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY не задано" }, { status: 500 });
  }
  const { message } = await req.json().catch(() => ({ message: "" }));
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Порожній запит" }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: [
        "Ти — AI-рієлтор платформи RentDirect (оренда від власників). З КОЖНОГО запиту витягни параметри і виклич search_listings.",
        "Правила мапінгу:",
        "- 'однокімнатна'/'1-кімнатна'/'студія' → rooms:1; 'двокімнатна'/'2-кімнатна' → rooms:2; 'трикімнатна'/'3-кімнатна' → rooms:3.",
        "- Назву району клади в district у називному відмінку: 'на Сихові'→'Сихів', 'на Франківському'→'Франківський', 'на Личаківському'→'Личаківський', 'в центрі'→'Центр'.",
        "- 'до X'/'дешевше X'/'не дорожче X' → max_price:X (ціле число без пробілів); 'від X' → min_price.",
        "- 'з твариною'/'з котиком'/'з собакою'/'можна з тваринами' → pets_allowed:true.",
        "- 'з меблями'/'мебльована' → furnished:true.",
        "- 'найдешевші'/'дешеві' → sort:cheapest; 'найновіші'/'свіжі'/'за сьогодні' → sort:newest.",
        "Відповідай коротко, дружньо, українською.",
      ].join("\n"),
    },
    { role: "user", content: message },
  ];

  try {
    const first = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools: [searchTool],
      // Агент завжди шукає: форсуємо виклик, щоб розмиті запити теж давали результат.
      tool_choice: { type: "function", function: { name: "search_listings" } },
      temperature: 0.2,
    });

    const choice = first.choices[0].message;
    const toolCall = choice.tool_calls?.[0];

    if (!toolCall || toolCall.type !== "function") {
      return NextResponse.json({ summary: choice.content ?? "Уточніть, будь ласка, параметри пошуку.", listings: [] });
    }

    const aiArgs: Args = JSON.parse(toolCall.function.arguments || "{}");
    // AI має пріоритет; regex-fallback заповнює те, що AI пропустив.
    const args: Args = { ...heuristicArgs(message), ...aiArgs };
    const listings = await runSearch(args);

    // Другий виклик: даємо AI результат → отримуємо дружнє резюме.
    messages.push(choice);
    messages.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content: JSON.stringify({
        count: listings.length,
        filters: args,
        sample: listings.slice(0, 5).map((l) => ({
          rooms: l.rooms,
          price: l.price,
          currency: l.currency,
          district: l.district,
        })),
      }),
    });

    const second = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.3,
    });

    const summary = second.choices[0].message.content ?? `Знайшов ${listings.length} варіант(ів).`;
    return NextResponse.json({ summary, listings });
  } catch (e) {
    console.error("[chat-search]", e);
    return NextResponse.json({ error: "Помилка AI-пошуку" }, { status: 500 });
  }
}
