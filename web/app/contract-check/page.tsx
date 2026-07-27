import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ContractScanner from "@/components/ContractScanner";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Перевірка договору — RentDirect" };

export default async function ContractCheckPage() {
  const supabase = createSupabaseServer();
  if (!supabase) redirect("/login");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/contract-check");

  return (
    <>
      <Navbar />
      <main className="flex-grow pt-[104px] px-margin-mobile md:px-margin-desktop max-w-3xl mx-auto w-full pb-16">
        <header className="text-center mb-8">
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Розумна перевірка договору</h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-xl mx-auto">
            Завантажте договір оренди (фото або PDF) — і AI одразу підсвітить приховані платежі
            та ризиковані пункти для орендаря.
          </p>
        </header>
        <ContractScanner />
      </main>
      <Footer />
    </>
  );
}
