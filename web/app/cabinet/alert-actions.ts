"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

const PROPERTY_TYPES = ["apartment", "house", "studio"];

export type AlertInput = {
  city: string | null;
  districts: string[];
  property_type: string | null;
  price_min: number | null;
  price_max: number | null;
  rooms: number | null;
  rooms_plus: boolean;
  instant: boolean;
};

/** Чи має користувач активну підписку — те саме, що робить is_subscriber() в БД. */
async function hasActiveSubscription(
  supabase: NonNullable<ReturnType<typeof createSupabaseServer>>,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("subscriptions")
    .select("current_period_end")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!data) return false;
  return data.current_period_end == null || new Date(data.current_period_end) > new Date();
}

/**
 * Зберігає критерії радара. Один запис на користувача: якщо вже є —
 * оновлюємо лише критерії, не чіпаючи link_token і telegram_chat_id
 * (інакше при кожному збереженні рвався б зв'язок з ботом).
 */
export async function saveAlert(input: AlertInput): Promise<Result> {
  const supabase = createSupabaseServer();
  if (!supabase) return { ok: false, error: "Немає з'єднання" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Потрібен вхід" };

  const clampInt = (n: number | null) =>
    n != null && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;

  const priceMin = clampInt(input.price_min);
  const priceMax = clampInt(input.price_max);
  if (priceMin != null && priceMax != null && priceMin > priceMax) {
    return { ok: false, error: "«Ціна від» більша за «до»" };
  }

  const propertyType =
    input.property_type && PROPERTY_TYPES.includes(input.property_type)
      ? input.property_type
      : null;

  const districts = Array.isArray(input.districts)
    ? Array.from(new Set(input.districts.map((d) => d.trim()).filter(Boolean)))
    : [];

  const roomsPlus = Boolean(input.rooms_plus);
  const rooms = roomsPlus ? 3 : clampInt(input.rooms);

  // Миттєва доставка — лише для Premium. Клієнт це блокує, але сервер вирішує:
  // без активної підписки прапорець завжди false, хоч би що надіслали.
  const instant = input.instant ? await hasActiveSubscription(supabase, user.id) : false;

  const criteria = {
    city: input.city?.trim() || null,
    districts,
    property_type: propertyType,
    price_min: priceMin,
    price_max: priceMax,
    rooms,
    rooms_plus: roomsPlus,
    instant,
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
