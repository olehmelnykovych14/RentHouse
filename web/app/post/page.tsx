import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ListingForm from "@/components/ListingForm";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Розмістити оголошення — RentDirect" };

export default async function PostPage() {
  const supabase = createSupabaseServer();
  if (!supabase) redirect("/login");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/post");

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <>
      <Navbar />
      <main className="flex-grow pt-[104px] px-margin-mobile md:px-margin-desktop max-w-3xl mx-auto w-full pb-16">
        <header className="mb-8">
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Розмістити оголошення</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Ваша квартира потрапить у каталог із позначкою «від власника» після короткої модерації.
            Без комісії та посередників.
          </p>
        </header>
        <ListingForm defaultContact={profile?.phone ?? ""} />
      </main>
      <Footer />
    </>
  );
}
