import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Публічний (anon) клієнт для читання listings_public.
// Повертає null, якщо env-змінні не задані — тоді фронт падає на мок-дані.
export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    // Дані оновлюються скраперами — не даємо Next кешувати відповіді Supabase.
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
