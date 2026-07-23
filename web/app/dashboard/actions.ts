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

/**
 * Записує оплату за конкретний період.
 *
 * dueDate приходить з клієнта, тож суму беремо з бази, а не з форми: інакше
 * можна було б записати оплату на довільне число.
 */
export async function markRentPaid(leaseId: string, dueDate: string): Promise<Result> {
  const ctx = await client();
  if (!ctx) return { ok: false, error: "Потрібен вхід" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return { ok: false, error: "Некоректна дата платежу" };

  const { data: lease } = await ctx.supabase
    .from("active_leases")
    .select("rent_amount")
    .eq("id", leaseId)
    .eq("user_id", ctx.user.id)
    .maybeSingle();

  if (!lease) return { ok: false, error: "Оренду не знайдено" };

  const { error } = await ctx.supabase
    .from("rent_payments")
    .insert({ lease_id: leaseId, due_date: dueDate, amount: lease.rent_amount });

  // 23505 — унікальний індекс (lease_id, due_date): період уже оплачено.
  // Це не помилка користувача, а подвійне натискання.
  if (error && error.code !== "23505") return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Скасовує позначку про оплату за конкретний період.
 *
 * Видаляємо за (lease_id, due_date), а не за id рядка: щойно доданий платіж
 * на екрані ще має тимчасовий id, і видалення за ним мовчки не спрацьовувало б —
 * Postgres не вважає помилкою видалення того, чого немає.
 */
export async function undoRentPayment(leaseId: string, dueDate: string): Promise<Result> {
  const ctx = await client();
  if (!ctx) return { ok: false, error: "Потрібен вхід" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return { ok: false, error: "Некоректна дата платежу" };

  // Належність перевіряє RLS через active_leases; select повертає видалені
  // рядки, тож видно, чи справді щось зникло.
  const { data, error } = await ctx.supabase
    .from("rent_payments")
    .delete()
    .eq("lease_id", leaseId)
    .eq("due_date", dueDate)
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "Платіж не знайдено" };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addUtilityBill(leaseId: string, formData: FormData): Promise<Result> {
  const ctx = await client();
  if (!ctx) return { ok: false, error: "Потрібен вхід" };

  const title = String(formData.get("title") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const category = String(formData.get("category") ?? "").trim() || null;
  if (!title) return { ok: false, error: "Вкажіть назву" };
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "Некоректна сума" };

  // Належність оренди перевіряє RLS-політика utility_logs через active_leases,
  // тож підставити чужий lease_id не вийде.
  const { error } = await ctx.supabase
    .from("utility_logs")
    .insert({ lease_id: leaseId, title, amount, category });

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
