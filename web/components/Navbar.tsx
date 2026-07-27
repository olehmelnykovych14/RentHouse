import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";

// «Гортати» тут немає навмисно: свайп — мобільний спосіб перегляду, а це
// меню видно лише на десктопі (hidden md:flex). Вхід у стрічку — з каталогу.
const LINKS = [
  { label: "Огляд", href: "/" },
  { label: "Оголошення", href: "/listings" },
  { label: "Перевірка договору", href: "/contract-check" },
  { label: "Обране", href: "/favorites" },
  { label: "Мій кабінет", href: "/dashboard" },
  { label: "Тарифи", href: "/pricing" },
];

export default async function Navbar() {
  const supabase = createSupabaseServer();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const user = data?.user ?? null;

  let displayName = user?.email ?? "";
  if (user && supabase) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    displayName = profile?.full_name || user.email || "";
  }
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";

  return (
    <nav className="fixed top-0 w-full z-50 bg-surface-container-lowest/80 backdrop-blur-md border-b border-surface-variant/20 shadow-sm">
      <div className="flex justify-between items-center h-16 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <Link href="/" className="font-display-lg text-headline-md font-bold text-primary">
          RentDirect
        </Link>

        <div className="hidden md:flex gap-gutter items-center">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="font-label-md text-label-md text-on-surface-variant hover:text-brand-blue transition-colors duration-200 relative after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-0 after:bg-brand-blue after:transition-[width] after:duration-300 after:ease-out-soft hover:after:w-full"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex gap-3 items-center">
          {user ? (
            <>
              <Link href="/cabinet" className="hidden md:flex items-center gap-2 max-w-[180px] group">
                <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-md text-label-md shrink-0">
                  {initial}
                </div>
                <span className="font-label-md text-label-md text-on-surface truncate group-hover:text-primary transition-colors">
                  {displayName}
                </span>
              </Link>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="font-label-md text-label-md text-on-surface-variant hover:text-brand-blue transition-colors duration-200 relative after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-0 after:bg-brand-blue after:transition-[width] after:duration-300 after:ease-out-soft hover:after:w-full"
                >
                  Вийти
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="hidden md:block font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
            >
              Увійти
            </Link>
          )}
          <Link
            href="/post"
            className="bg-primary text-on-primary font-label-md text-label-md px-4 py-2 rounded-lg active:scale-95 transition-transform"
          >
            + Опублікувати оголошення
          </Link>
        </div>
      </div>
    </nav>
  );
}
