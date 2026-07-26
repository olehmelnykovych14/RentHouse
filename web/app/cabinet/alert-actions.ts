"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Зберігає критерії сповіщень. Один запис на користувача: якщо вже є —
 * оновлюємо лише критерії, не чіпаючи link_token і telegram_chat_id
 * (інакше при кожному збереженні рвався б зв'язок з ботом).
 */
export async function saveAlert(formData: FormData): Promise<Result> {
  const supabase = createSupabaseServer();
  if (!supabase) return { ok: false, error: "Немає з'єднання" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Потрібен вхід" };

  const str = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v || null;
  };
  const int = (k: string) => {
    const v = formData.get(k);
    if (v == null || String(v).trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  };

  const roomsRaw = String(formData.get("rooms") ?? "").trim(); // "", "1", "2", "3+"
  const roomsPlus = roomsRaw === "3+";
  const rooms = roomsPlus ? 3 : int("rooms");

  const priceMin = int("price_min");
  const priceMax = int("price_max");
  if (priceMin != null && priceMax != null && priceMin > priceMax) {
    return { ok: false, error: "«Ціна від» більша за «до»" };
  }

  const criteria = {
    city: str("city"),
    district: str("district"),
    price_min: priceMin,
    price_max: priceMax,
    rooms,
    rooms_plus: roomsPlus,
    active: true,
  };

  const { data: existing } = await supabase
    .from("alert_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("alert_subscriptions").update(criteria).eq("user_id", user.id)
    : await supabase.from("alert_subscriptions").insert({ user_id: user.id, ...criteria });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/cabinet");
  return { ok: true };
}

/** Вимкнути сповіщення (не видаляючи прив'язку до бота). */
export async function toggleAlert(active: boolean): Promise<Result> {
  const supabase = createSupabaseServer();
  if (!supabase) return { ok: false, error: "Немає з'єднання" };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Потрібен вхід" };

  const { error } = await supabase
    .from("alert_subscriptions")
    .update({ active })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/cabinet");
  return { ok: true };
}
