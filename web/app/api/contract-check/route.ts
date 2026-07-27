import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { fileRejectReason, type ContractReview } from "@/lib/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Аналіз великого договору моделлю буває довгим — піднімаємо ліміт.
export const maxDuration = 120;

const SYSTEM = `Ти — юридичний асистент платформи оренди RentDirect. Аналізуєш договір оренди житла в Україні ВИКЛЮЧНО з позиції ОРЕНДАРЯ: що в ньому ризиковано або несправедливо саме для того, хто знімає житло.

ПОРЯДОК:
1) Спершу визнач, чи це взагалі договір оренди/найму житла. Якщо ні (інший документ, нечитабельне фото) — is_rental_contract=false, коротко поясни в summary, масиви лиши порожніми.
2) red_flags — пункти, НЕВИГІДНІ орендарю. Типові приклади:
   - виселення з коротким або без попередження; розірвання договору власником будь-коли
   - орендар оплачує ВСІ ремонти, зокрема капітальні чи зношення
   - одностороннє підвищення орендної плати власником
   - завеликі штрафи, неповернення застави за будь-якої причини
   - вхід власника в житло без попередження
   - відповідальність орендаря за вже наявні пошкодження
   - автоматичне продовження на невигідних умовах
   Для кожного: clause — номер пункту з тексту ("Пункт 3.2"), якщо є, інакше "";
   severity — high (серйозно шкодить) або medium (варто обговорити).
3) safe_clauses — пункти, що виглядають чесно/стандартно (справедлива застава, комуналка за лічильниками/тарифами, розумний строк попередження).

ПРАВИЛА:
- Спирайся ТІЛЬКИ на текст документа. Не вигадуй пунктів і не додавай загальних порад, яких у договорі немає.
- Формулюй стисло, простою українською, зрозуміло людині без юридичної освіти.
- pages — приблизна кількість сторінок (0, якщо не зрозуміло).
- summary — 1–2 речення в тоні уважного помічника: ВЕДИ З ГОЛОВНОГО — скільки серйозних ризиків знайшов і чи договір загалом стандартний. Напр.: «Переглянув договір на N стор. Загалом виглядає стандартно, але є 2 критичні пункти, які варто обговорити з власником.» Якщо серйозних ризиків немає — так і скажи.
- Це попередній огляд, НЕ юридична консультація — тон інформативний, без категоричних юридичних тверджень.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    is_rental_contract: { type: "boolean" },
    document_type: { type: "string", description: "Що це за документ, кількома словами" },
    pages: { type: "integer" },
    summary: { type: "string", description: "1–2 речення: загальне враження + скільки критичних ризиків" },
    red_flags: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          clause: { type: "string" },
          title: { type: "string" },
          detail: { type: "string" },
          severity: { type: "string", enum: ["high", "medium"] },
        },
        required: ["clause", "title", "detail", "severity"],
      },
    },
    safe_clauses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
        },
        required: ["title", "detail"],
      },
    },
  },
  required: ["is_rental_contract", "document_type", "pages", "summary", "red_flags", "safe_clauses"],
} as const;

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY не задано" }, { status: 500 });
  }

  // Перевірка договору — лише для залогінених: ендпоінт коштовний (AI).
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!user) return NextResponse.json({ error: "Потрібно увійти" }, { status: 401 });

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: "Не вдалося прочитати файл" }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "Файл не надіслано" }, { status: 400 });

  const reject = fileRejectReason(file.type, file.size);
  if (reject) return NextResponse.json({ error: reject }, { status: 400 });

  const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const dataUrl = `data:${file.type};base64,${b64}`;
  const isPdf = file.type === "application/pdf";

  // gpt-4o читає і сканований PDF, і фото — PDF як file-частина, зображення як image_url.
  const documentPart = isPdf
    ? { type: "file", file: { filename: file.name || "contract.pdf", file_data: dataUrl } }
    : { type: "image_url", image_url: { url: dataUrl } };

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: { name: "contract_review", strict: true, schema: SCHEMA },
      },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          // Тип file-частини ще не в публічних типах SDK — вміст як union частин.
          content: [
            { type: "text", text: "Проаналізуй цей договір оренди українською." },
            documentPart,
          ] as unknown as OpenAI.Chat.ChatCompletionContentPart[],
        },
      ],
    });

    const raw = resp.choices[0]?.message?.content;
    if (!raw) return NextResponse.json({ error: "Порожня відповідь AI" }, { status: 502 });

    const review = JSON.parse(raw) as ContractReview;
    return NextResponse.json({ review });
  } catch (e) {
    console.error("[contract-check]", e);
    return NextResponse.json({ error: "Не вдалося проаналізувати документ" }, { status: 500 });
  }
}
