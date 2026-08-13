"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Власник змінює статус СВОГО оголошення: `rented` (здано → зникає з каталогу)
 * або назад `active`. RLS-політика update_own уже обмежує чужі рядки; `posted_by`
 * тут — подвійний захист. Так каталог не показує вже здані квартири.
 */
export async function setListingStatus(
  id: string,
  status: "rented" | "active"
): Promise<Result> {
  const supabase = createSupabaseServer();
  if (!supabase) return { ok: false, error: "Немає з'єднання" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Потрібен вхід" };

  const { error } = await supabase
    .from("listings")
    .update({ status })
    .eq("id", id)
    .eq("posted_by", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/cabinet");
  return { ok: true };
}
