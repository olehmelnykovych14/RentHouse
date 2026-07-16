import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";

const LINKS = [
  { label: "Explore", href: "/" },
  { label: "Listings", href: "/listings" },
  { label: "Favorites", href: "/favorites" },
  { label: "Pricing", href: "/pricing" },
];

export default async function Navbar() {
  const supabase = createSupabaseServer();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const user = data?.user ?? null;

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
              className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex gap-3 items-center">
          {user ? (
            <>
              <span className="hidden md:inline font-caption text-caption text-on-surface-variant max-w-[160px] truncate">
                {user.email}
              </span>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
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
          <button className="bg-primary text-on-primary font-label-md text-label-md px-4 py-2 rounded-lg active:scale-95 transition-transform">
            Post Listing
          </button>
        </div>
      </div>
    </nav>
  );
}
