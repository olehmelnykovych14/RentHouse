"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { AUTO_EXPIRE_AT, type ReportReason } from "@/lib/report";

type Result = { ok: true; expired: boolean } | { ok: false; error: string };

/**
 * Скарга на оголошення. Одна на користувача (unique у БД), тож повторна
 * спроба — не помилка, а «вже враховано».
 *
 * Після AUTO_EXPIRE_AT незалежних скарг «вже здано» знімаємо оголошення
 * автоматично: орендар, який подзвонив, знає це раніше за будь-який скрапер.
 * Решта причин лише накопичуються — рішення за модератором, бо «це ріелтор»
 * оспорюване, а помилково зняти чесне оголошення дорого.
 */
export async function reportListing(
  listingId: string,
  reason: ReportReason,
  comment?: string
): Promise<Result> {
  const supabase = createSupabaseServer();
  if (!supabase) return { ok: false, error: "Немає з'єднання" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Увійдіть, щоб поскаржитись" };

  const { error } = await supabase.from("listing_reports").insert({
    listing_id: listingId,
    user_id: user.id,
    reason,
    comment: comment?.trim() || null,
  });

  // 23505 = unique violation: користувач уже скаржився. Не помилка для нього.
  if (error && error.code !== "23505") {
    return { ok: false, error: error.message };
  }

  let expired = false;
  if (reason === "rented") {
    const admin = createSupabaseAdmin();
    if (admin) {
      const { count } = await admin
        .from("listing_reports")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", listingId)
        .eq("reason", "rented");
      if ((count ?? 0) >= AUTO_EXPIRE_AT) {
        await admin.from("listings").update({ status: "expired" }).eq("id", listingId);
        expired = true;
      }
    }
  }

  revalidatePath(`/listings/${listingId}`);
  return { ok: true, expired };
}
