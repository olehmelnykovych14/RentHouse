import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  PLANS,
  CURRENCY,
  WAYFORPAY_PAY_URL,
  purchaseSignature,
  buildOrderReference,
} from "@/lib/wayforpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const merchantAccount = process.env.WAYFORPAY_MERCHANT_ACCOUNT;
  const merchantDomainName = process.env.WAYFORPAY_MERCHANT_DOMAIN;
  const secret = process.env.WAYFORPAY_SECRET_KEY;
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  if (!merchantAccount || !merchantDomainName || !secret) {
    return NextResponse.json({ error: "WayForPay не налаштовано" }, { status: 500 });
  }

  // Тільки залогінений користувач може оформити підписку.
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!user) return NextResponse.json({ error: "Потрібно увійти" }, { status: 401 });

  const { plan } = await req.json().catch(() => ({ plan: "" }));
  const cfg = PLANS[plan as string];
  if (!cfg) return NextResponse.json({ error: "Невідомий тариф" }, { status: 400 });

  const orderReference = buildOrderReference(user.id, plan);
  const orderDate = Math.floor(Date.now() / 1000);

  const signature = purchaseSignature({
    merchantAccount,
    merchantDomainName,
    orderReference,
    orderDate,
    amount: cfg.price,
    currency: CURRENCY,
    productName: cfg.name,
    productCount: 1,
    productPrice: cfg.price,
    secret,
  });

  // Поля форми, які клієнт зашле POST-ом на WayForPay.
  const fields: Record<string, string | number | Array<string | number>> = {
    merchantAccount,
    merchantDomainName,
    merchantTransactionSecureType: "AUTO",
    orderReference,
    orderDate,
    amount: cfg.price,
    currency: CURRENCY,
    productName: [cfg.name],
    productCount: [1],
    productPrice: [cfg.price],
    clientEmail: user.email ?? "",
    returnUrl: `${site}/cabinet?paid=1`,
    serviceUrl: `${site}/api/pay/wayforpay/callback`,
    merchantSignature: signature,
    language: "UA",
  };

  return NextResponse.json({ url: WAYFORPAY_PAY_URL, fields });
}
