#!/usr/bin/env python3
"""
Бот сповіщень: прив'язує Telegram користувача до його критеріїв і надсилає
нові квартири, щойно вони зʼявляються.

Дві задачі в одному циклі:
  1) getUpdates — ловить «/start <token>» з deep-link кабінету й записує
     chat_id у alert_subscriptions за link_token.
  2) розсилка — кожні POLL_SECONDS шукає оголошення, новіші за last_notified_at
     кожної підписки, що підходять під критерії, і шле їх у Telegram.

Запуск (потрібні TELEGRAM_BOT_TOKEN, SUPABASE_* у config.py):
    python telegram_alert_bot.py
"""
import html
import time

import requests

import config
from supabase import create_client

BOT_TOKEN = config.TELEGRAM_BOT_TOKEN
API = f"https://api.telegram.org/bot{BOT_TOKEN}"
POLL_SECONDS = 30
SEND_LIMIT_PER_SUB = 5  # за один прохід — щоб при першому підключенні не завалити

sb = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)


def send_message(chat_id: int, text: str) -> bool:
    try:
        r = requests.post(
            f"{API}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": False},
            timeout=15,
        )
        return r.json().get("ok", False)
    except Exception as e:
        print(f"send error: {e}")
        return False


# ── 1. Прив'язка через /start <token> ───────────────────────────────

def handle_start(chat_id: int, token: str) -> None:
    token = (token or "").strip()
    if not token:
        send_message(chat_id, "Привіт! Щоб отримувати сповіщення, відкрийте бота "
                              "кнопкою «Підключити Telegram-бота» у кабінеті на сайті.")
        return

    try:
        rows = (
            sb.table("alert_subscriptions").select("id")
            .eq("link_token", token).limit(1).execute().data
        )
    except Exception as e:
        print(f"lookup error: {e}")
        rows = []

    if not rows:
        send_message(chat_id, "Не вдалося знайти ваші критерії. Спробуйте ще раз "
                              "із кабінету на сайті.")
        return

    # last_notified_at = зараз: шлемо лише майбутні оголошення, не потоп старих.
    from datetime import datetime, timezone
    sb.table("alert_subscriptions").update({
        "telegram_chat_id": chat_id,
        "last_notified_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", rows[0]["id"]).execute()

    send_message(chat_id, "✅ Підключено! Надсилатимемо нові квартири від власників "
                          "за вашими критеріями, щойно вони зʼявляються.")


def poll_updates(offset: int) -> int:
    try:
        r = requests.get(f"{API}/getUpdates", params={"offset": offset, "timeout": 20}, timeout=25)
        data = r.json()
    except Exception as e:
        print(f"getUpdates error: {e}")
        return offset

    for upd in data.get("result", []):
        offset = upd["update_id"] + 1
        msg = upd.get("message") or {}
        text = msg.get("text") or ""
        chat_id = (msg.get("chat") or {}).get("id")
        if chat_id and text.startswith("/start"):
            parts = text.split(maxsplit=1)
            handle_start(chat_id, parts[1] if len(parts) > 1 else "")
    return offset


# ── 2. Розсилка нових оголошень ─────────────────────────────────────

def matches(listing: dict, sub: dict) -> bool:
    if sub.get("city") and (listing.get("city") or "") != sub["city"]:
        return False
    if sub.get("district"):
        if sub["district"].lower() not in (listing.get("district") or "").lower():
            return False
    price = listing.get("price_uah")
    if sub.get("price_min") is not None and (price is None or price < sub["price_min"]):
        return False
    if sub.get("price_max") is not None and (price is None or price > sub["price_max"]):
        return False
    if sub.get("rooms") is not None:
        rooms = listing.get("rooms")
        if rooms is None:
            return False
        if sub.get("rooms_plus"):
            if rooms < sub["rooms"]:
                return False
        elif rooms != sub["rooms"]:
            return False
    return True


def format_listing(l: dict) -> str:
    title = html.escape(l.get("title") or "Квартира")
    price = l.get("price_uah")
    price_str = f"{price:,} ₴/міс".replace(",", " ") if price else "Ціна не вказана"
    loc = ", ".join(x for x in (l.get("city"), l.get("district")) if x)
    url = l.get("url") or ""
    lines = [f"🏠 <b>{title[:90]}</b>", f"💰 {price_str}"]
    if loc:
        lines.append(f"📍 {html.escape(loc)}")
    if url:
        lines.append(url)
    return "\n".join(lines)


def dispatch_new_listings() -> None:
    subs = (
        sb.table("alert_subscriptions").select("*")
        .eq("active", True).not_.is_("telegram_chat_id", "null").execute().data
    )
    for sub in subs:
        # Тільки те, що зʼявилось після останнього сповіщення цієї підписки,
        # і лише каталожні типи (owner / agency_no_fee).
        rows = (
            sb.table("listings")
            .select("title,price_uah,city,district,rooms,url,created_at,listing_type,probability_of_owner,status")
            .eq("status", "active")
            .gt("created_at", sub["last_notified_at"])
            .order("created_at", desc=False)
            .limit(200)
            .execute().data
        )
        catalog = [
            r for r in rows
            if (r["listing_type"] == "owner" and (r.get("probability_of_owner") or 0) >= 70)
            or r["listing_type"] == "agency_no_fee"
        ]
        hits = [r for r in catalog if matches(r, sub)]
        if not hits:
            # Посуваємо мітку навіть без збігів, щоб не перечитувати одне й те саме.
            if rows:
                sb.table("alert_subscriptions").update(
                    {"last_notified_at": rows[-1]["created_at"]}
                ).eq("id", sub["id"]).execute()
            continue

        sent = 0
        for l in hits[:SEND_LIMIT_PER_SUB]:
            if send_message(sub["telegram_chat_id"], format_listing(l)):
                sent += 1
            time.sleep(0.4)  # не впираємось у ліміти Telegram

        # Мітка = час найновішого надісланого (або останнього переглянутого).
        newest = hits[min(SEND_LIMIT_PER_SUB, len(hits)) - 1]["created_at"]
        sb.table("alert_subscriptions").update(
            {"last_notified_at": newest}
        ).eq("id", sub["id"]).execute()
        if sent:
            print(f"sub {sub['id'][:8]}: надіслано {sent}")


def main():
    print("🔔 Бот сповіщень запущено. Ctrl+C щоб зупинити.")
    offset = 0
    last_dispatch = 0.0
    while True:
        offset = poll_updates(offset)
        now = time.time()
        if now - last_dispatch >= POLL_SECONDS:
            try:
                dispatch_new_listings()
            except Exception as e:
                print(f"dispatch error: {e}")
            last_dispatch = now
        time.sleep(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nЗупинено.")
