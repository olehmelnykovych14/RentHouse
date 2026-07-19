"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function FavoriteButton({
  listingId,
  initial = false,
  className = "",
}: {
  listingId: string;
  initial?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [fav, setFav] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const supabase = createSupabaseBrowser();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    if (fav) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("listing_id", listingId);
      setFav(false);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, listing_id: listingId });
      setFav(true);
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-label={fav ? "Прибрати з обраного" : "Додати в обране"}
      className={`transition-colors ${fav ? "text-error" : "text-outline hover:text-error"} ${className}`}
    >
      <span className="material-symbols-outlined" style={fav ? { fontVariationSettings: "'FILL' 1" } : {}}>
        {fav ? "favorite" : "favorite_border"}
      </span>
    </button>
  );
}
