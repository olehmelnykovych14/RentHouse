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
      </main>
      <Footer />
    </>
  );
}
