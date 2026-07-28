"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";

type Result = { ok: true } | { ok: false; error: string };

/** Повертає service-role клієнт, лише якщо запитувач — адмін. Інакше null. */
async function adminClientFor() {
  const supabase = createSupabaseServer();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return createSupabaseAdmin();
}

/**
 * Схвалити оголошення на модерації → в каталог. Це людське підтвердження, що
 * подав власник, тож ставимо owner_verified=true (мітка «Перевірений власник»).
 * `.eq("status","pending")` — щоб не чіпати вже оброблені.
 */
export async function approveListing(id: string): Promise<Result> {
  const admin = await adminClientFor();
  if (!admin) return { ok: false, error: "Немає доступу" };
  const { error } = await admin
    .from("listings")
    .update({ status: "active", owner_verified: true })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

/** Відхилити → знімаємо (status=removed, оборотно). */
export async function rejectListing(id: string): Promise<Result> {
  const admin = await adminClientFor();
  if (!admin) return { ok: false, error: "Немає доступу" };
  const { error } = await admin
    .from("listings")
    .update({ status: "removed" })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}
