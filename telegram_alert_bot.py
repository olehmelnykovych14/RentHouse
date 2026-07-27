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
from datetime import datetime, timezone

import requests

import config
from supabase import create_client

BOT_TOKEN = config.TELEGRAM_BOT_TOKEN
API = f"https://api.telegram.org/bot{BOT_TOKEN}"
POLL_SECONDS = 30
SEND_LIMIT_PER_SUB = 5  # за один прохід — щоб при першому підключенні не завалити
DIGEST_INTERVAL_SEC = 24 * 3600  # free-каданс: дайджест не частіше ніж раз на добу
DIGEST_MAX = 10                  # скільки квартир максимум в одному дайджесті


def parse_ts(s: str):
    """ISO-час із Supabase → aware datetime (None, якщо не парситься)."""
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def is_premium(user_id: str) -> bool:
    """Активна підписка = миттєва доставка. Те саме, що is_subscriber() у БД."""
    if not user_id:
        return False
    try:
        rows = (
            sb.table("subscriptions").select("current_period_end")
            .eq("user_id", user_id).eq("status", "active").limit(1).execute().data
        )
    except Exception as e:
        print(f"premium check error: {e}")
        return False
    if not rows:
        return False
    end = parse_ts(rows[0].get("current_period_end"))
    return end is None or end > datetime.now(timezone.utc)

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
    # Райони: АБО-логіка. Підходить, якщо район оголошення містить будь-який
    # з обраних. Порожній список = будь-який район.
    districts = sub.get("districts") or []
    if districts:
        ld = (listing.get("district") or "").lower()
        if not any((d or "").lower() in ld for d in districts):
            return False
    ptype = sub.get("property_type")
    if ptype and (listing.get("property_type") or "") != ptype:
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


def format_digest(hits: list[dict]) -> str:
    """Один згорнутий лист для free-каданса замість пачки окремих."""
    head = f"🔔 <b>Нові квартири за вашим радаром — {len(hits)}</b>"
    lines = [head, ""]
    for l in hits[:DIGEST_MAX]:
        price = l.get("price_uah")
        price_str = f"{price:,} ₴".replace(",", " ") if price else "ціна н/д"
        loc = ", ".join(x for x in (l.get("city"), l.get("district")) if x)
        title = html.escape((l.get("title") or "Квартира")[:70])
        url = l.get("url") or ""
        row = f"• <b>{price_str}</b> — {title}"
        if loc:
            row += f" ({html.escape(loc)})"
        if url:
            row += f"\n  {url}"
        lines.append(row)
    if len(hits) > DIGEST_MAX:
        lines.append(f"\n…та ще {len(hits) - DIGEST_MAX}. Оформіть Premium для миттєвих сповіщень.")
    return "\n".join(lines)


def dispatch_new_listings() -> None:
    subs = (
        sb.table("alert_subscriptions").select("*")
        .eq("active", True).not_.is_("telegram_chat_id", "null").execute().data
    )
    now = datetime.now(timezone.utc)
    for sub in subs:
        # Миттєво — лише Premium із увімкненим instant. Решта — раз на добу.
        instant_ok = bool(sub.get("instant")) and is_premium(sub.get("user_id"))
        if not instant_ok:
            last = parse_ts(sub.get("last_notified_at"))
            if last and (now - last).total_seconds() < DIGEST_INTERVAL_SEC:
                continue  # доба ще не минула — накопичуємо далі

        # Тільки те, що зʼявилось після останнього сповіщення цієї підписки,
        # і лише каталожні типи (owner / agency_no_fee).
        rows = (
            sb.table("listings")
            .select("title,price_uah,city,district,rooms,property_type,url,created_at,listing_type,probability_of_owner,status")
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

        if instant_ok:
            sent = 0
            for l in hits[:SEND_LIMIT_PER_SUB]:
                if send_message(sub["telegram_chat_id"], format_listing(l)):
                    sent += 1
                time.sleep(0.4)  # не впираємось у ліміти Telegram
            # Мітка = час найновішого надісланого; решта — наступного проходу.
            newest = hits[min(SEND_LIMIT_PER_SUB, len(hits)) - 1]["created_at"]
            if sent:
                print(f"sub {sub['id'][:8]}: миттєво надіслано {sent}")
        else:
            # Дайджест: один лист на всі збіги, мітку двигаємо до найновішого
            # ПЕРЕГЛЯНУТОГО, щоб добовий цикл не повторював те саме.
            if send_message(sub["telegram_chat_id"], format_digest(hits)):
                print(f"sub {sub['id'][:8]}: дайджест на {len(hits)}")
            newest = rows[-1]["created_at"]

        sb.table("alert_subscriptions").update(
            {"last_notified_at": newest}
        ).eq("id", sub["id"]).execute()


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
