import crypto from "crypto";

export const WAYFORPAY_PAY_URL = "https://secure.wayforpay.com/pay";
export const CURRENCY = "UAH";

// SKU підписок — єдине джерело правди для цін: сторінка тарифів читає їх звідси,
// тож показане й те, що спишеться, не розходяться. Спринт (7 днів) — «спробувати»,
// місячний — основна підписка.
export const PLANS: Record<string, { name: string; price: number; days: number }> = {
  sprint: { name: "RentDirect Спринт (7 днів)", price: 49, days: 7 },
  premium: { name: "RentDirect Преміум (місяць)", price: 99, days: 30 },
};

export function hmacMd5(secret: string, parts: (string | number)[]): string {
  return crypto.createHmac("md5", secret).update(parts.join(";"), "utf8").digest("hex");
}

// Підпис запиту на оплату (Purchase). Порядок полів суворо за докою WayForPay.
export function purchaseSignature(p: {
  merchantAccount: string;
  merchantDomainName: string;
  orderReference: string;
  orderDate: number;
  amount: number;
  currency: string;
  productName: string;
  productCount: number;
  productPrice: number;
  secret: string;
}): string {
  return hmacMd5(p.secret, [
    p.merchantAccount,
    p.merchantDomainName,
    p.orderReference,
    p.orderDate,
    p.amount,
    p.currency,
    p.productName,
    p.productCount,
    p.productPrice,
  ]);
}

// Підпис, який WayForPay надсилає в callback — перевіряємо його.
export function callbackSignature(p: {
  merchantAccount: string;
  orderReference: string;
  amount: number | string;
  currency: string;
  authCode: string;
  cardPan: string;
  transactionStatus: string;
  reasonCode: string | number;
  secret: string;
}): string {
  return hmacMd5(p.secret, [
    p.merchantAccount,
    p.orderReference,
    p.amount,
    p.currency,
    p.authCode,
    p.cardPan,
    p.transactionStatus,
    p.reasonCode,
  ]);
}

// Підпис відповіді, яку МИ повертаємо WayForPay (accept).
export function acceptSignature(orderReference: string, status: string, time: number, secret: string): string {
  return hmacMd5(secret, [orderReference, status, time]);
}

// orderReference кодує користувача і план, щоб callback знав, кому активувати підписку.
export function buildOrderReference(userId: string, plan: string): string {
  return `${userId}--${plan}--${Date.now()}`;
}

export function parseOrderReference(ref: string): { userId: string; plan: string } | null {
  const parts = ref.split("--");
  if (parts.length < 2) return null;
  return { userId: parts[0], plan: parts[1] };
}
