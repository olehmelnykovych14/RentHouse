"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Усі записи йдуть через серверні дії, а не через браузерний клієнт: тоді
 * RLS перевіряє справжню сесію користувача, а не те, що надіслав фронтенд.
 */

const COLUMNS = ["favorites", "contacted", "viewings_scheduled"] as const;
export type BoardColumn = (typeof COLUMNS)[number];

type Result = { ok: true } | { ok: false; error: string };

async function client() {
  const supabase = createSupabaseServer();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

// ── Дошка пошуку ─────────────────────────────────────────────────

export async function moveCard(listingId: string, status: string): Promise<Result> {
  // Статус приходить з браузера, тож звіряємо зі списком дозволених:
  // check-constraint у базі теж не пропустив би, але помилка була б сирою.
  if (!COLUMNS.includes(status as BoardColumn)) {
    return { ok: false, error: "Невідома колонка" };
  }
  const ctx = await client();
  if (!ctx) return { ok: false, error: "Потрібен вхід" };

  const { error } = await ctx.supabase
    .from("favorites")
    .update({ status })
    .eq("user_id", ctx.user.id)
    .eq("listing_id", listingId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function saveNote(listingId: string, note: string): Promise<Result> {
  const ctx = await client();
  if (!ctx) return { ok: false, error: "Потрібен вхід" };

  const trimmed = note.trim();
  const { error } = await ctx.supabase
    .from("favorites")
    .update({ personal_note: trimmed || null })
    .eq("user_id", ctx.user.id)
    .eq("listing_id", listingId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function archiveCard(listingId: string): Promise<Result> {
  const ctx = await client();
  if (!ctx) return { ok: false, error: "Потрібен вхід" };

  const { error } = await ctx.supabase
    .from("favorites")
    .delete()
    .eq("user_id", ctx.user.id)
    .eq("listing_id", listingId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

// ── Оренда ───────────────────────────────────────────────────────

export async function createLease(formData: FormData): Promise<Result> {
  const ctx = await client();
  if (!ctx) return { ok: false, error: "Потрібен вхід" };

  const address = String(formData.get("property_address") ?? "").trim();
  const rent = Number(formData.get("rent_amount"));
  const day = Number(formData.get("payment_day"));
  const endDate = String(formData.get("lease_end_date") ?? "");

  if (!address) return { ok: false, error: "Вкажіть адресу" };
  if (!Number.isFinite(rent) || rent < 0) return { ok: false, error: "Некоректна сума оренди" };
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return { ok: false, error: "День платежу має бути від 1 до 31" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return { ok: false, error: "Вкажіть дату закінчення" };

  const { error } = await ctx.supabase.from("active_leases").insert({
    user_id: ctx.user.id,
    property_address: address,
    rent_amount: rent,
    payment_day: day,
    lease_end_date: endDate,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markRentPaid(leaseId: string): Promise<Result> {
  const ctx = await client();
  if (!ctx) return { ok: false, error: "Потрібен вхід" };

  // Дата в локальному календарі користувача: toISOString() дав би UTC і
  // ввечері записав би завтрашній день.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;

  const { error } = await ctx.supabase
    .from("active_leases")
    .update({ last_paid_on: today })
    .eq("id", leaseId)
    .eq("user_id", ctx.user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addUtilityBill(leaseId: string, formData: FormData): Promise<Result> {
  const ctx = await client();
  if (!ctx) return { ok: false, error: "Потрібен вхід" };

  const title = String(formData.get("title") ?? "").trim();
  const amount = Number(formData.get("amount"));
  if (!title) return { ok: false, error: "Вкажіть назву" };
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "Некоректна сума" };

  // Належність оренди перевіряє RLS-політика utility_logs через active_leases,
  // тож підставити чужий lease_id не вийде.
  const { error } = await ctx.supabase
    .from("utility_logs")
    .insert({ lease_id: leaseId, title, amount });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteUtilityBill(id: string): Promise<Result> {
  const ctx = await client();
  if (!ctx) return { ok: false, error: "Потрібен вхід" };

  const { error } = await ctx.supabase.from("utility_logs").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
