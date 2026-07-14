import Link from "next/link";

const LINKS = [
  { label: "Explore", href: "/", active: true },
  { label: "Listings", href: "/listings", active: false },
  { label: "Favorites", href: "/favorites", active: false },
  { label: "Pricing", href: "/pricing", active: false },
];

export default function Navbar() {
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
              className={
                l.active
                  ? "font-label-md text-label-md text-primary border-b-2 border-primary pb-1"
                  : "font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
              }
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex gap-4 items-center">
          <button className="hidden md:block font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors">
            Sign In
          </button>
          <button className="bg-primary text-on-primary font-label-md text-label-md px-4 py-2 rounded-lg active:scale-95 transition-transform">
            Post Listing
          </button>
        </div>
      </div>
    </nav>
  );
}
