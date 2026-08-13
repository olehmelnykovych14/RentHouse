import { redirect, notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ModerationQueue, { type PendingListing } from "@/components/ModerationQueue";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Модерація — RentDirect" };

export default async function AdminPage() {
  const supabase = createSupabaseServer();
  if (!supabase) redirect("/login");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  // Не адмін → 404: сторінка навіть не існує для сторонніх.
  if (!isAdminEmail(user.email)) notFound();

  const admin = createSupabaseAdmin();
  const cols =
    "id,title,clean_description,price,currency,city,district,rooms,area_sqm,seller_contact,photos,created_at,source";
  const { data } = admin
    ? await admin.from("listings").select(cols).eq("status", "pending").order("created_at", { ascending: true })
    : { data: [] };
  const pending = (data ?? []) as PendingListing[];

  // Скарги на активні оголошення — другий бік модерації. Групуємо за
  // оголошенням, щоб модератор бачив «на це скаржились 3 рази», а не список.
  const { data: reportRows } = admin
    ? await admin
        .from("listing_reports")
        .select("listing_id, reason, created_at, listings(title, city, district, status)")
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] };

  type ReportRow = {
    listing_id: string;
    reason: string;
    listings: { title: string | null; city: string | null; district: string | null; status: string | null } | null;
  };
  const grouped = new Map<string, { title: string; place: string; status: string; reasons: Record<string, number> }>();
  for (const r of (reportRows ?? []) as unknown as ReportRow[]) {
    const l = r.listings;
    if (!l || l.status !== "active") continue; // знятi вже не цікаві
    const g = grouped.get(r.listing_id) ?? {
      title: l.title || "Оголошення",
      place: [l.district, l.city].filter(Boolean).join(", ") || "—",
      status: l.status ?? "",
      reasons: {},
    };
    g.reasons[r.reason] = (g.reasons[r.reason] ?? 0) + 1;
    grouped.set(r.listing_id, g);
  }
  const reported = [...grouped.entries()].sort(
    (a, b) =>
      Object.values(b[1].reasons).reduce((s, n) => s + n, 0) -
      Object.values(a[1].reasons).reduce((s, n) => s + n, 0)
  );

  const REASON_LABEL: Record<string, string> = {
    rented: "вже здано",
    agent: "посередник",
    scam: "шахрайство",
    wrong: "невірні дані",
  };

  return (
    <>
      <Navbar />
      <main className="flex-grow pt-[104px] px-margin-mobile md:px-margin-desktop max-w-4xl mx-auto w-full pb-16">
        <header className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface mb-1">Модерація</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Оголошення від власників, що очікують на перевірку перед публікацією.
            </p>
          </div>
          <span className="bg-tertiary-container text-on-tertiary-container font-label-md text-label-md px-3 py-1.5 rounded-full">
            У черзі: {pending.length}
          </span>
        </header>

        {!admin ? (
          <p className="bg-error-container text-on-error-container font-body-md text-body-md rounded-lg px-4 py-3">
            SUPABASE_SERVICE_KEY не налаштовано — модерація недоступна.
          </p>
        ) : (
          <ModerationQueue listings={pending} />
        )}

        {/* Скарги на активні оголошення */}
        {reported.length > 0 && (
          <section className="mt-gutter">
            <h2 className="font-headline-sm text-title-lg text-on-surface flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[22px] text-error">flag</span>
              Скарги на активні оголошення ({reported.length})
            </h2>
            <ul className="bg-surface-container-lowest border border-surface-variant rounded-xl divide-y divide-surface-variant">
              {reported.map(([id, g]) => (
                <li key={id} className="p-4 flex items-center gap-3 flex-wrap">
                  <a
                    href={`/listings/${id}`}
                    className="min-w-0 flex-grow font-label-md text-label-md text-on-surface hover:text-primary transition-colors truncate"
                  >
                    {g.title}
                    <span className="block font-caption text-caption text-on-surface-variant">{g.place}</span>
                  </a>
                  <div className="flex gap-1.5 flex-wrap shrink-0">
                    {Object.entries(g.reasons).map(([reason, n]) => (
                      <span
                        key={reason}
                        className={`font-caption text-caption px-2 py-0.5 rounded ${
                          reason === "rented" || reason === "scam"
                            ? "bg-error-container text-on-error-container"
                            : "bg-surface-container-high text-on-surface-variant"
                        }`}
                      >
                        {REASON_LABEL[reason] ?? reason} · {n}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
