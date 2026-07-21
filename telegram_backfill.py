#!/usr/bin/env python3
"""
Розбір ІСТОРІЇ Telegram-каналів (на відміну від telegram_parser.py, який слухає
лише нові повідомлення в реальному часі).

Навіщо: щоб наповнити базу вже наявними оголошеннями, а не чекати нових.
Проганяє останні повідомлення каналів через ту саму AI-екстракцію та
класифікацію (owner / agency_no_fee / agency), зберігає фото у Storage.

Запуск (потрібна Telethon-сесія):
    python telegram_backfill.py [messages_per_channel]
"""

import asyncio
import sys

from telethon import TelegramClient

import telegram_parser as tp


MESSAGES_PER_CHANNEL = int(sys.argv[1]) if len(sys.argv) > 1 else 20
MIN_TEXT_LEN = 40


def ascii_safe(s: str) -> str:
    return (s or "").encode("ascii", "backslashreplace").decode()


async def photos_from_message(client, message, external_id: str) -> list[str]:
    """Завантажує фото повідомлення у Supabase Storage."""
    if not getattr(message, "photo", None):
        return []
    try:
        data = await client.download_media(message, file=bytes)
    except Exception:
        return []
    url = tp.upload_photo_bytes_to_storage(data, external_id, 0)
    return [url] if url else []


async def main():
    client = TelegramClient("realtor_session", tp.API_ID, tp.API_HASH)
    await client.connect()
    if not await client.is_user_authorized():
        print("Сесія не авторизована — запустіть парсер один раз інтерактивно.")
        return

    tp.seed_channels_to_db()
    channels = tp.load_active_channels()
    print(f"Каналів: {len(channels)} | повідомлень з каналу: {MESSAGES_PER_CHANNEL}\n")

    stats = {"scanned": 0, "analysed": 0, "rejected": 0, "saved": 0,
             "owner": 0, "no_fee": 0, "agency": 0}

    for ch in channels:
        try:
            entity = await client.get_entity(ch)
        except Exception as e:
            print(f"  -- @{ch}: {ascii_safe(str(e))[:60]}")
            continue

        username = getattr(entity, "username", None) or ch
        got = 0
        async for message in client.iter_messages(entity, limit=MESSAGES_PER_CHANNEL):
            stats["scanned"] += 1
            text = message.message or ""
            if len(text) < MIN_TEXT_LEN:
                continue

            external_id = f"{message.chat_id}_{message.id}"
            link = f"https://t.me/{username}/{message.id}"

            extraction = tp.ai_check(text)
            stats["analysed"] += 1

            # Канали оренди повні продажу, запитів «шукаю житло» й реклами —
            # фото таких постів навіть не качаємо.
            reason = tp.reject_reason(extraction)
            if reason:
                stats["rejected"] += 1
                continue

            listing_type, _ = tp.classify(extraction)
            stats[{"owner": "owner", "agency_no_fee": "no_fee"}.get(listing_type, "agency")] += 1

            photos = await photos_from_message(client, message, external_id)
            city = tp.CHANNEL_CITY.get(username.lower())
            tp.upsert_listing_to_supabase(extraction, external_id, link, text, photos, city)
            stats["saved"] += 1
            got += 1

        print(f"  @{ascii_safe(username):28} збережено {got}")

    await client.disconnect()
    print("\n" + "=" * 46)
    print(f"Переглянуто повідомлень : {stats['scanned']}")
    print(f"Проаналізовано AI       : {stats['analysed']}")
    print(f"Відсіяно (не оренда)    : {stats['rejected']}")
    print(f"Збережено в базу        : {stats['saved']}")
    print(f"  власники              : {stats['owner']}")
    print(f"  агенція без комісії   : {stats['no_fee']}")
    print(f"  агенція               : {stats['agency']}")


if __name__ == "__main__":
    asyncio.run(main())
