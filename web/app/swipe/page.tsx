import Link from "next/link";
import Navbar from "@/components/Navbar";
import SwipeDeck from "@/components/swipe/SwipeDeck";
import { getSwipeListings } from "@/lib/listings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Гортати квартири — RentDirect" };

export default async function SwipePage() {
  const listings = await getSwipeListings();

  return (
    <>
      <Navbar />
      {/* Вужче за каталог: стрічка — це «одна картка в фокусі», а не сітка.
          На десктопі центруємо колонкою телефонної ширини. */}
      <main className="flex-grow pt-[92px] px-margin-mobile pb-10">
        <div className="max-w-sm mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-headline-md text-headline-md text-on-surface">Гортати</h1>
            <Link
              href="/listings"
              className="font-label-sm text-label-sm text-on-surface-variant hover:text-brand-blue transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[18px]">grid_view</span>
              Списком
            </Link>
          </div>

          <SwipeDeck listings={listings} />
        </div>
      </main>
    </>
  );
}
