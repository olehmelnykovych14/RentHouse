"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-margin-mobile bg-background" style={{ backgroundImage: "radial-gradient(#e0e3e5 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
      <div className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-level-2 p-8 border border-surface-variant relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
        <div className="text-center mb-8">
          <Link href="/" className="font-display-lg text-headline-lg font-bold text-primary mb-2 inline-block">
            RentDirect
          </Link>
          <p className="font-body-md text-body-md text-on-surface-variant">З поверненням. Увійдіть у свій акаунт.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          {error && (
            <div className="bg-error-container text-on-error-container font-caption text-caption p-3 rounded-lg">{error}</div>
          )}
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2" htmlFor="email">
              Електронна пошта
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ваша@пошта.com"
              className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-variant rounded-lg font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2" htmlFor="password">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-variant rounded-lg font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:bg-primary-container transition-colors disabled:opacity-60"
          >
            {loading ? "Входимо…" : "Увійти"}
          </button>
        </form>

        <p className="mt-8 text-center font-caption text-caption text-on-surface-variant">
          Немає акаунту?{" "}
          <Link href="/register" className="text-primary font-semibold hover:underline">
            Зареєструватися
          </Link>
        </p>
      </div>
    </main>
  );
}
