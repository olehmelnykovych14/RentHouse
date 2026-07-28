#!/usr/bin/env python3
"""
Знімає з каталогу мертві оголошення (source olx/dimria): перевіряє URL, і якщо
сторінка зникла (404/410) або показує «знято/неактивне» — ставить status=expired.

Довіра — головна обіцянка продукту; орендар, який дзвонить на зняті квартири,
йде назавжди. Telegram сюди не беремо: t.me не дає надійного сигналу «знято».

Без --apply лише показує, що буде знято.
Запуск:  python expire_dead_listings.py [--apply] [--limit N]
"""
import sys
import time

import requests

import config
from supabase import create_client

APPLY = "--apply" in sys.argv
LIMIT = 1000
if "--limit" in sys.argv:
    try:
        LIMIT = int(sys.argv[sys.argv.index("--limit") + 1])
    except (IndexError, ValueError):
        pass

sb = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def check(url: str) -> tuple[bool, str]:
    """
    (мертве?, причина). Мертве = сторінку прибрано (404/410).

    Свідомо НЕ шукаємо «знято» в тексті: фрази на кшталт «більше не доступне»
    трапляються в бойлерплейті живих сторінок і давали хибні спрацювання, а
    зняти живе оголошення гірше, ніж пропустити мертве. Мережеві збої (таймаут)
    теж не караємо. Знята пропозиція на OLX/dom.ria стабільно віддає 404/410.
    """
    try:
        r = requests.get(url, headers=HEADERS, timeout=20, allow_redirects=True)
    except Exception as e:
        return False, f"мережа: {e}"
    if r.status_code in (404, 410):
        return True, f"HTTP {r.status_code}"
    return False, f"HTTP {r.status_code}"


def main() -> None:
    rows = (
        sb.table("listings").select("id,url,source,title")
        .in_("source", ["olx", "dimria"]).eq("status", "active")
        .limit(LIMIT).execute().data
    )
    print(f"перевіряю {len(rows)} активних olx/dimria-оголошень…\n")

    dead: list[tuple[dict, str]] = []
    for r in rows:
        is_dead, reason = check(r["url"])
        if is_dead:
            dead.append((r, reason))
            print(f"  DEAD [{reason}] {(r['title'] or '')[:55]}")
        time.sleep(0.3)  # не гатимо джерела

    print(f"\nперевірено {len(rows)} | мертвих {len(dead)}")
    if not dead:
        return

    if APPLY:
        ids = [r["id"] for r, _ in dead]
        for i in range(0, len(ids), 50):
            sb.table("listings").update({"status": "expired"}).in_("id", ids[i:i + 50]).execute()
        print(f"✅ знято {len(ids)} (status=expired)")
    else:
        print("(dry-run) додай --apply, щоб зняти їх із каталогу")


if __name__ == "__main__":
    main()
