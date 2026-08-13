import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  PLANS,
  callbackSignature,
  acceptSignature,
  parseOrderReference,
} from "@/lib/wayforpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.WAYFORPAY_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 500 });

  // WayForPay шле JSON (іноді як єдине form-поле) — парсимо обидва варіанти.
  const raw = await req.text();
  let p: Record<string, unknown> = {};
  try {
    p = JSON.parse(raw);
  } catch {
    const params = new URLSearchParams(raw);
    const first = [...params.keys()][0] ?? "";
    try {
      p = JSON.parse(first);
    } catch {
      p = {};
    }
  }

  const orderReference = String(p.orderReference ?? "");
  const expected = callbackSignature({
    merchantAccount: String(p.merchantAccount ?? ""),
    orderReference,
    amount: p.amount as number,
    currency: String(p.currency ?? ""),
    authCode: String(p.authCode ?? ""),
    cardPan: String(p.cardPan ?? ""),
    transactionStatus: String(p.transactionStatus ?? ""),
    reasonCode: p.reasonCode as string,
    secret,
  });

  const signatureOk = expected === String(p.merchantSignature ?? "");

  // Активуємо підписку лише для валідного підпису + успішної транзакції.
  if (signatureOk && p.transactionStatus === "Approved") {
    const parsed = parseOrderReference(orderReference);
    const admin = createSupabaseAdmin();
    if (parsed && admin) {
      const cfg = PLANS[parsed.plan] ?? PLANS.premium;
      const end = new Date(Date.now() + cfg.days * 86400000).toISOString();
      try {
        await admin.from("subscriptions").insert({
          user_id: parsed.userId,
          status: "active",
          plan: parsed.plan,
          current_period_end: end,
          provider_customer_id: orderReference,
        });
      } catch (e) {
        console.error("[wayforpay] subscription insert:", e);
      }
    }
  } else if (!signatureOk) {
    console.warn("[wayforpay] invalid signature for", orderReference);
  }

  // Підтвердження для WayForPay (щоб припинив ретраї).
  const time = Math.floor(Date.now() / 1000);
  return NextResponse.json({
    orderReference,
    status: "accept",
    time,
    signature: acceptSignature(orderReference, "accept", time, secret),
  });
}
