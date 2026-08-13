import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DashboardTabs from "@/components/dashboard/DashboardTabs";
import type { BoardCard } from "@/components/dashboard/SearchBoard";
import type { UtilityBill } from "@/components/dashboard/LeaseTracker";
import type { Lease, RentPayment } from "@/lib/lease";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Мій кабінет — RentDirect" };

export default async function DashboardPage() {
  const supabase = createSupabaseServer();
  if (!supabase) redirect("/login");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Помилки запитів збираємо, а не ковтаємо. Порожній список і зламаний
  // запит виглядають на екрані однаково — і саме так зниклі записи
  // здаються видаленими, хоча вони на місці.
  const problems: string[] = [];

  // Дошка: обране + дані оголошень. Читаємо оголошення через listings_public,
  // щоб контакт лишався замаскованим для тих, хто без підписки.
  const { data: favorites, error: favoritesError } = await supabase
    .from("favorites")
    .select("listing_id, status, personal_note")
    .eq("user_id", user.id);
  if (favoritesError) problems.push(`Дошка пошуку: ${favoritesError.message}`);

  const ids = (favorites ?? []).map((f) => f.listing_id);
  const { data: listings } = ids.length
    ? await supabase
        .from("listings_public")
        .select("id, title, price, currency, city, district, photos, seller_contact")
        .in("id", ids)
    : { data: [] };

  const byId = new Map((listings ?? []).map((l) => [l.id, l]));
  const cards: BoardCard[] = (favorites ?? []).map((f) => {
    const l = byId.get(f.listing_id);
    return {
      listing_id: f.listing_id,
      status: (f.status ?? "favorites") as BoardCard["status"],
      personal_note: f.personal_note ?? null,
      title: l?.title ?? null,
      price: l?.price ?? null,
      currency: l?.currency ?? null,
      city: l?.city ?? null,
      district: l?.district ?? null,
      photo: l?.photos?.[0] ?? null,
      seller_contact: l?.seller_contact ?? null,
    };
  });

  // Активна оренда — беремо найсвіжішу, якщо їх кілька.
  const { data: lease, error: leaseError } = await supabase
    .from("active_leases")
    .select("id, property_address, rent_amount, payment_day, lease_start_date, lease_end_date")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (leaseError) problems.push(`Оренда: ${leaseError.message}`);

  const { data: bills, error: billsError } = lease
    ? await supabase
        .from("utility_logs")
        .select("id, title, amount, category, created_at")
        .eq("lease_id", lease.id)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (billsError) problems.push(`Комунальні платежі: ${billsError.message}`);

  const { data: payments, error: paymentsError } = lease
    ? await supabase
        .from("rent_payments")
        .select("id, due_date, amount, paid_on")
        .eq("lease_id", lease.id)
        .order("due_date", { ascending: false })
    : { data: [], error: null };
  if (paymentsError) problems.push(`Історія платежів: ${paymentsError.message}`);

  return (
    <>
      <Navbar />
      <main className="flex-grow pt-[104px] px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto w-full pb-16">
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Мій кабінет</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mb-8">
          Ведіть пошук квартири та стежте за поточною орендою в одному місці.
        </p>

        {problems.length > 0 && (
          <div className="mb-6 bg-error-container text-on-error-container rounded-xl p-4">
            <p className="font-label-md text-label-md mb-1">
              Частина даних не завантажилась
            </p>
            <p className="font-body-sm text-body-sm mb-2">
              Записи не видалено — їх не вдалося прочитати. Найчастіше це означає,
              що не застосовано міграцію бази.
            </p>
            <ul className="font-caption text-caption list-disc pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}

        <DashboardTabs
          cards={cards}
          lease={(lease as Lease | null) ?? null}
          payments={(payments as RentPayment[]) ?? []}
          bills={(bills as UtilityBill[]) ?? []}
        />
      </main>
      <Footer />
    </>
  );
}
