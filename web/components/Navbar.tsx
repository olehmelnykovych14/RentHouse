import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import ProfileMenu from "./ProfileMenu";

// Вгорі лишаємо тільки основний перегляд. Особисте (кабінет, перевірка
// договору, профіль, вихід) переїхало у випадайку під аватаром — інакше
// рядок переповнювався. Меню видно лише на десктопі (hidden md:flex).
const LINKS = [
  { label: "Огляд", href: "/" },
  { label: "Оголошення", href: "/listings" },
  { label: "Обране", href: "/favorites" },
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
            <ProfileMenu displayName={displayName} initial={initial} />
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
