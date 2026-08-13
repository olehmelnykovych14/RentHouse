#!/usr/bin/env python3
"""
Пошук Telegram-каналів оренди по містах.

Навіщо: у Telegram немає параметра «місто» — одиницею є канал. Тому щоб покрити
нове місто, канали цього міста треба СПОЧАТКУ ЗНАЙТИ. Скрипт шукає публічні
канали за ключовими словами й складає їх у channel_sources зі статусом 'pending'
і тегом міста. Далі адмін переглядає й переводить потрібні в 'active' —
telegram_parser бере в роботу лише активні.

Запуск (потрібна ваша Telethon-сесія, та сама, що й у парсера):
    python telegram_discover.py
"""

import asyncio
import os

from telethon import TelegramClient
from telethon.tl.functions.contacts import SearchRequest

try:
    import config
except ImportError:
    config = None


def get_secret(name: str, default: str = "") -> str:
    if config is not None and hasattr(config, name):
        return getattr(config, name)
    return os.getenv(name, default)


_api_id = get_secret("TG_API_ID", "")
API_ID = int(_api_id) if _api_id else None
API_HASH = get_secret("TG_API_HASH")
SUPABASE_URL = get_secret("SUPABASE_URL")
SUPABASE_SERVICE_KEY = get_secret("SUPABASE_SERVICE_KEY")

CITIES = [
    "Київ", "Львів", "Одеса", "Дніпро", "Харків",
    "Вінниця", "Тернопіль", "Івано-Франківськ", "Запоріжжя", "Полтава",
]

# Шаблони запитів. Telegram шукає за назвою/описом каналу, тож пробуємо кілька формулювань.
QUERY_TEMPLATES = [
    "оренда квартир {city}",
    "зняти квартиру {city}",
    "оренда {city} без посередників",
    "нерухомість {city}",
]

SEARCH_LIMIT = 50

tg_client = TelegramClient("realtor_session", API_ID, API_HASH)

supabase = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    from supabase import create_client
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def queue_candidate(username: str, title: str, city: str) -> bool:
    """Кладе канал у channel_sources як 'pending'. True, якщо це новий запис."""
    if supabase is None:
        return False
    try:
        supabase.table("channel_sources").upsert(
            {
                "platform": "telegram",
                "identifier": username,
                "city": city,
                "status": "pending",
                "source": "search",
            },
            on_conflict="platform,identifier",
            ignore_duplicates=True,
        ).execute()
        return True
    except Exception as e:
        print(f"  ⚠️ {username}: {e}")
        return False


async def main():
    await tg_client.start()
    print("🔓 Авторизація успішна. Шукаю канали по містах...\n")

    seen: set[str] = set()
    per_city: dict[str, int] = {}

    for city in CITIES:
        found_here = 0
        for tpl in QUERY_TEMPLATES:
            query = tpl.format(city=city)
            try:
                res = await tg_client(SearchRequest(q=query, limit=SEARCH_LIMIT))
            except Exception as e:
                print(f"  ⚠️ пошук '{query}': {e}")
                continue

            for chat in res.chats:
                username = getattr(chat, "username", None)
                if not username or username.lower() in seen:
                    continue
                # Беремо лише публічні канали/групи
                if not (getattr(chat, "broadcast", False) or getattr(chat, "megagroup", False)):
                    continue
                seen.add(username.lower())
                queue_candidate(username, getattr(chat, "title", ""), city)
                found_here += 1
                print(f"  + {city:18} @{username}  — {getattr(chat, 'title', '')[:50]}")

            await asyncio.sleep(1)  # не тиснемо на Telegram

        per_city[city] = found_here

    print("\n" + "=" * 50)
    print("Кандидатів знайдено:")
    for city, n in per_city.items():
        print(f"  {city:18} {n}")
    print(f"\nВсього: {sum(per_city.values())}")
    print(
        "\nУсі додані зі статусом 'pending'. Переглянь їх у Supabase (таблиця channel_sources)\n"
        "і постав status='active' тим, які справді про оренду — парсер бере лише активні."
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Зупинено.")
