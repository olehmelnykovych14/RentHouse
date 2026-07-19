import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role клієнт (обходить RLS). Використовувати ЛИШЕ на сервері —
 * у webhook-ах платежів для запису в subscriptions. Ключ серверний (без NEXT_PUBLIC).
 */
export function createSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
