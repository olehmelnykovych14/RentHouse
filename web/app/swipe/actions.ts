"use server";

import { createSupabaseServer } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string; needAuth?: boolean };

/**
 * Свайп вправо = додати в обране. Пишемо через серверну дію, щоб RLS
 * перевіряв справжню сесію. Дизлайки в базі не зберігаємо: це вимагало б
 * окремої таблиці «показаних», а для стрічки достатньо не повторювати їх
 * у межах сеансу (клієнт тримає їх у localStorage).
 */
export async function likeListing(listingId: string): Promise<Result> {
  const supabase = createSupabaseServer();
  if (!supabase) return { ok: false, error: "Немає з'єднання" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Потрібен вхід", needAuth: true };

  const { error } = await supabase
    .from("favorites")
    .upsert(
      { user_id: user.id, listing_id: listingId, status: "favorites" },
      { onConflict: "user_id,listing_id", ignoreDuplicates: true }
    );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Відкликання лайку — для кнопки «назад» у стрічці. */
export async function unlikeListing(listingId: string): Promise<Result> {
  const supabase = createSupabaseServer();
  if (!supabase) return { ok: false, error: "Немає з'єднання" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Потрібен вхід", needAuth: true };

  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("listing_id", listingId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
