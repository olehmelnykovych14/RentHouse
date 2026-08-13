import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Серверний клієнт Supabase із сесією з cookies.
 * Запити виконуються від імені залогіненого користувача, тож is_subscriber()
 * у listings_public реагує на реальну підписку. null, якщо env не задано.
 */
export function createSupabaseServer(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const cookieStore = cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Викликано із Server Component — запис cookies тут заборонено.
          // Сесію оновлює middleware, тож це безпечно ігнорувати.
        }
      },
    },
  });
}
