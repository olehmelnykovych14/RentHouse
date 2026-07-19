"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SubscribeButton({
  plan,
  children,
  className = "",
}: {
  plan: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/pay/wayforpay/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Помилка оплати");
        setLoading(false);
        return;
      }

      // Будуємо форму й сабмітимо POST-ом на WayForPay.
      const form = document.createElement("form");
      form.method = "POST";
      form.action = data.url;
      form.acceptCharset = "utf-8";
      for (const [k, v] of Object.entries(data.fields as Record<string, unknown>)) {
        const values = Array.isArray(v) ? v : [v];
        const name = Array.isArray(v) ? `${k}[]` : k;
        values.forEach((item) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.value = String(item);
          form.appendChild(input);
        });
      }
      document.body.appendChild(form);
      form.submit();
    } catch {
      alert("Не вдалося почати оплату");
      setLoading(false);
    }
  }

  return (
    <button onClick={onClick} disabled={loading} className={className}>
      {loading ? "Хвилинку…" : children}
    </button>
  );
}
