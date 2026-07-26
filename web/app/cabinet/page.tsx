import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AlertSettings, { type AlertSub } from "@/components/AlertSettings";
import MyListings, { type MyListing } from "@/components/MyListings";
import { createSupabaseServer } from "@/lib/supabase/server";

// Публічний юзернейм бота (не токен) — для deep-link прив'язки.
const ALERT_BOT_USERNAME = "realtor_fast_poshuk_bot";

export const dynamic = "force-dynamic";
export const metadata = { title: "Кабінет — RentDirect" };

export default async function CabinetPage() {
  const supabase = createSupabaseServer();
  if (!supabase) redirect("/login");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, role")
    .eq("id", user.id)
    .maybeSingle();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  // Статистика — лише з реальних даних. Переглядів і повідомлень з макета не
  // показуємо: ми їх не рахуємо, а вигадані числа гірші за їх відсутність.
  const { data: favs } = await supabase
    .from("favorites")
    .select("status")
    .eq("user_id", user.id);
  const favList = favs ?? [];
  const stats = {
    saved: favList.length,
    contacted: favList.filter((f) => f.status === "contacted").length,
    viewings: favList.filter((f) => f.status === "viewings_scheduled").length,
  };
  const { count: leaseCount } = await supabase
    .from("active_leases")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Оголошення, які користувач сам розмістив (RLS повертає лише власні рядки,
  // будь-якого статусу — на відміну від каталогу, який показує лише active).
  const { data: myRows } = await supabase
    .from("listings")
    .select("id, title, city, district, price, currency, status, photos, created_at")
    .eq("posted_by", user.id)
    .order("created_at", { ascending: false });
  const myListings = (myRows ?? []) as MyListing[];

  // Критерії Telegram-сповіщень. connected = бот уже прив'язав chat_id.
  const { data: alertRow } = await supabase
    .from("alert_subscriptions")
    .select("city, district, price_min, price_max, rooms, rooms_plus, active, link_token, telegram_chat_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const alertSub: AlertSub | null = alertRow
    ? {
        city: alertRow.city,
        district: alertRow.district,
        price_min: alertRow.price_min,
        price_max: alertRow.price_max,
        rooms: alertRow.rooms,
        rooms_plus: alertRow.rooms_plus,
        active: alertRow.active,
        link_token: alertRow.link_token,
        connected: alertRow.telegram_chat_id != null,
      }
    : null;

  const name = profile?.full_name || user.email || "Користувач";
  const initial = name.trim().charAt(0).toUpperCase() || "U";
  const roleLabel = profile?.role === "owner" ? "Власник" : "Орендар";
  const planLabel = sub?.plan ? `Активна: ${sub.plan}` : "Базовий (безкоштовний)";

  return (
    <>
      <Navbar />
      <main className="flex-grow pt-[104px] px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto w-full pb-16">
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-8">Кабінет</h1>

        {/* Статистика пошуку. Кожна картка веде в кабінет-дошку до потрібної
            колонки — це не просто число, а вхід у роботу з ним. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-gutter mb-gutter">
          <StatCard
            href="/favorites"
            icon="favorite"
            value={stats.saved}
            label="Збережено квартир"
          />
          <StatCard
            href="/dashboard"
            icon="call"
            value={stats.contacted}
            label="Зв'язалися з власником"
          />
          <StatCard
            href="/dashboard"
            icon="event_available"
            value={stats.viewings}
            label="Заплановано переглядів"
          />
          <StatCard
            href="/dashboard"
            icon="home"
            value={leaseCount ?? 0}
            label="Активна оренда"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
          {/* Профіль */}
          <section className="lg:col-span-2 bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center font-headline-md text-headline-md">
                {initial}
              </div>
              <div>
                <h2 className="font-headline-md text-headline-md text-on-background">{name}</h2>
                <span className="inline-flex items-center gap-1 bg-primary-fixed/40 text-primary px-2 py-0.5 rounded font-caption text-caption mt-1">
                  <span className="material-symbols-outlined text-[14px]">
                    {profile?.role === "owner" ? "real_estate_agent" : "person"}
                  </span>
                  {roleLabel}
                </span>
              </div>
            </div>
            <dl className="divide-y divide-surface-variant">
              <Row label="Пошта" value={user.email ?? "—"} />
              <Row label="Телефон" value={profile?.phone || "—"} />
              <Row label="Тип профілю" value={roleLabel} />
            </dl>
          </section>

          {/* Підписка + швидкі дії */}
          <aside className="flex flex-col gap-gutter">
            <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
              <h3 className="font-label-md text-label-md text-on-surface-variant mb-2">Підписка</h3>
              <p className="font-headline-md text-headline-md text-primary mb-4">{planLabel}</p>
              <Link
                href="/pricing"
                className="block text-center w-full bg-primary text-on-primary font-label-md text-label-md py-2.5 rounded-lg hover:bg-primary-container transition-colors"
              >
                {sub ? "Керувати" : "Оформити Premium"}
              </Link>
            </div>

            <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6 flex flex-col gap-3">
              <Link href="/post" className="flex items-center gap-2 text-on-surface hover:text-primary transition-colors font-label-md text-label-md">
                <span className="material-symbols-outlined">add_home</span> Розмістити оголошення
              </Link>
              <Link href="/favorites" className="flex items-center gap-2 text-on-surface hover:text-primary transition-colors font-label-md text-label-md">
                <span className="material-symbols-outlined">favorite</span> Обране
              </Link>
              <Link href="/listings" className="flex items-center gap-2 text-on-surface hover:text-primary transition-colors font-label-md text-label-md">
                <span className="material-symbols-outlined">grid_view</span> Каталог
              </Link>
              <form action="/auth/signout" method="post">
                <button type="submit" className="flex items-center gap-2 text-on-surface-variant hover:text-error transition-colors font-label-md text-label-md">
                  <span className="material-symbols-outlined">logout</span> Вийти
                </button>
              </form>
            </div>
          </aside>
        </div>

        <div className="mt-gutter">
          <MyListings listings={myListings} />
        </div>

        <div className="mt-gutter max-w-xl">
          <AlertSettings sub={alertSub} botUsername={ALERT_BOT_USERNAME} />
        </div>
      </main>
      <Footer />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-3">
      <dt className="font-body-md text-body-md text-on-surface-variant">{label}</dt>
      <dd className="font-label-md text-label-md text-on-surface">{value}</dd>
    </div>
  );
}

function StatCard({
  href,
  icon,
  value,
  label,
}: {
  href: string;
  icon: string;
  value: number;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="bg-surface-container-lowest border border-surface-variant rounded-xl p-5 flex flex-col gap-2 hover:shadow-card-hover hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200 ease-out-soft"
    >
      <span className="w-9 h-9 rounded-full bg-primary-fixed/40 text-primary flex items-center justify-center">
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </span>
      <span className="font-display-lg text-headline-lg text-on-surface leading-none">
        {value}
      </span>
      <span className="font-caption text-caption text-on-surface-variant">{label}</span>
    </Link>
  );
}
