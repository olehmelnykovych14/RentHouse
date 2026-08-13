"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<"tenant" | "owner">("tenant");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowser();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone, role } },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      router.push("/");
      router.refresh();
    } else {
      setNotice("Акаунт створено. Перевірте пошту для підтвердження, потім увійдіть.");
    }
  }

  const inputCls =
    "w-full px-3 py-2 bg-surface-container-lowest border border-surface-variant rounded font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all";

  return (
    <main className="min-h-screen flex items-center justify-center p-margin-mobile bg-background">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-level-2 border border-surface-variant overflow-hidden">
        <div className="px-8 pt-8 pb-6 text-center border-b border-surface-variant/50">
          <Link href="/" className="font-display-lg text-headline-md text-primary mb-2 inline-block font-bold">
            RentDirect
          </Link>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Створіть акаунт для доступу до платформи оренди.
          </p>
        </div>

        <form onSubmit={onSubmit} className="p-8 space-y-6">
          {error && (
            <div className="bg-error-container text-on-error-container font-caption text-caption p-3 rounded-lg">{error}</div>
          )}
          {notice && (
            <div className="bg-secondary-container text-on-secondary-container font-caption text-caption p-3 rounded-lg">{notice}</div>
          )}

          <fieldset className="space-y-2">
            <legend className="font-label-md text-label-md text-on-surface mb-1">Оберіть тип профілю</legend>
            <div className="grid grid-cols-2 gap-4">
              {([
                { value: "tenant", label: "Орендар", icon: "person" },
                { value: "owner", label: "Власник", icon: "real_estate_agent" },
              ] as const).map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setRole(opt.value)}
                  className={`flex flex-col items-center justify-center p-4 border rounded-lg transition-colors text-center ${
                    role === opt.value
                      ? "border-primary bg-primary-fixed"
                      : "border-outline-variant hover:bg-surface-container-low"
                  }`}
                >
                  <span className={`material-symbols-outlined mb-2 ${role === opt.value ? "text-primary" : "text-outline"}`}>
                    {opt.icon}
                  </span>
                  <span className="font-label-md text-label-md text-on-surface">{opt.label}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="full_name">Повне ім&apos;я</label>
            <input id="full_name" type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Іван Іваненко" className={inputCls} />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="email">Електронна пошта</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ivan@example.com" className={inputCls} />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="phone">Номер телефону</label>
            <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+380 (XX) XXX-XX-XX" className={inputCls} />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="password">Пароль</label>
            <input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputCls} />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:bg-primary-container transition-colors disabled:opacity-60"
          >
            {loading ? "Створюємо…" : "Зареєструватися"}
          </button>
        </form>

        <div className="px-8 py-6 bg-surface-container-low border-t border-surface-variant text-center">
          <p className="font-body-md text-body-md text-on-surface-variant">
            Вже маєте акаунт?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">Увійти</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
