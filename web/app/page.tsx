import Link from "next/link";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ListingCard from "@/components/ListingCard";
import OwnerCTA from "@/components/OwnerCTA";
import Footer from "@/components/Footer";
import { getPopularListings } from "@/lib/listings";

// Дані змінюються (скрапери пишуть постійно) — рендеримо динамічно, без кешу.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const listings = await getPopularListings(3);

  return (
    <>
      <Navbar />
      <main className="flex-grow pt-16">
        <Hero />

        {/* Популярні варіанти */}
        <section className="py-24 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2">Популярні варіанти</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Ретельно відібрані пропозиції від перевірених власників.
              </p>
            </div>
            <Link
              href="/listings"
              className="hidden md:flex items-center font-label-md text-label-md text-primary hover:underline"
            >
              Всі квартири <span className="material-symbols-outlined ml-1">arrow_forward</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>

          <Link
            href="/listings"
            className="md:hidden mt-8 w-full flex justify-center items-center font-label-md text-label-md text-primary bg-surface-container py-3 rounded-lg"
          >
            Всі квартири
          </Link>
        </section>

        <OwnerCTA />
      </main>
      <Footer />
    </>
  );
}
