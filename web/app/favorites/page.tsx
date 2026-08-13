import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CatalogCard from "@/components/CatalogCard";
import { getFavoriteListings } from "@/lib/listings";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Обране — RentDirect" };

export default async function FavoritesPage() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const listings = user ? await getFavoriteListings() : [];

  return (
    <>
      <Navbar />
      <main className="flex-grow pt-[104px] px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto w-full pb-16">
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-8">Обране</h1>

        {!user ? (
          <div className="text-center py-24 text-on-surface-variant">
            <span className="material-symbols-outlined text-[48px] mb-2">favorite</span>
            <p className="font-body-md text-body-md mb-4">Увійдіть, щоб зберігати квартири в обране.</p>
            <Link
              href="/login"
              className="inline-block bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded-lg hover:bg-primary-container transition-colors"
            >
              Увійти
            </Link>
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-24 text-on-surface-variant">
            <span className="material-symbols-outlined text-[48px] mb-2">favorite_border</span>
            <p className="font-body-md text-body-md mb-4">Поки що порожньо. Додавайте квартири серцем на картці.</p>
            <Link
              href="/listings"
              className="inline-block bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded-lg hover:bg-primary-container transition-colors"
            >
              До каталогу
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
            {listings.map((l) => (
              <CatalogCard key={l.id} listing={l} favorited />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
