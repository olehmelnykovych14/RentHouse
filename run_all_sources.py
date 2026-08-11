#!/usr/bin/env python3
"""
Разовий прогін усіх трьох джерел: dom.ria, OLX, Telegram.

Штатні run_monitor() — нескінченні цикли для фонової служби. Тут потрібен
один прохід із підсумком, тому цикл розгортаємо вручну.

Відправку в Telegram-бот глушимо: це наповнення бази, а не сповіщення.

    python run_all_sources.py [dimria] [olx] [telegram]   # без аргументів — усі
"""
import sys
import time
from collections import Counter

import config
from supabase import create_client

WANTED = {a.lower() for a in sys.argv[1:]} or {"dimria", "olx", "telegram"}

sb = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)


def snapshot() -> Counter:
    rows = sb.table("listings").select("source,listing_type").limit(5000).execute().data
    return Counter((r["source"], r["listing_type"]) for r in rows)


def run_dimria(pages: int = 10):
    import dimria_monitor as dm

    dm.MAX_PAGES = pages
    seen = dm.load_seen_ads()
    session = dm.make_session()
    for city in dm.MONITOR_CITIES:
        print(f"  dom.ria: {city['name']}")
        for page in range(pages):
            ids, _ = dm.fetch_ids(session, page, city)
            if not ids:
                break
            for realty_id in ids:
                dm.process_id(session, realty_id, seen)
    dm.save_seen_ads(seen)


def run_olx(pages: int = 10):
    import olx_monitor_1 as om

    om.MAX_PAGES = pages
    om.send_telegram = lambda *a, **k: True   # не спамимо бот
    seen = om.load_seen_ads()
    session = om.make_session()
    for src in om.MONITOR_SOURCES:
        print(f"  OLX: {src['city']}")
        stubs = om.fetch_listing_urls(session, src["url"])
        for stub in stubs:
            stub["city"] = src["city"]
        om.stealth_sleep(2, 4)
        for stub in stubs:
            ad_id = om.process_ad(session, stub, seen)
            if ad_id:
                seen.add(ad_id)
    om.save_seen_ads(seen)


def run_telegram(limit: int = 100):
    import asyncio
    import telegram_backfill as tb

    tb.MESSAGES_PER_CHANNEL = limit
    asyncio.run(tb.main())


def main():
    before = snapshot()
    started = time.time()

    for name, fn in (("dimria", run_dimria), ("olx", run_olx), ("telegram", run_telegram)):
        if name not in WANTED:
            continue
        print(f"\n{'='*54}\n{name.upper()}\n{'='*54}")
        try:
            fn()
        except Exception as e:
            print(f"  {name} впав: {type(e).__name__}: {e}")

    after = snapshot()
    print(f"\n{'='*54}\nПІДСУМОК за {(time.time()-started)/60:.1f} хв\n{'='*54}")
    print(f"{'джерело':<10} {'тип':<15} {'було':>6} {'стало':>6} {'+':>5}")
    for key in sorted(set(before) | set(after)):
        b, a = before.get(key, 0), after.get(key, 0)
        if a != b or a:
            print(f"{key[0]:<10} {str(key[1]):<15} {b:>6} {a:>6} {a-b:>+5}")

    total_b, total_a = sum(before.values()), sum(after.values())
    print(f"\nвсього: {total_b} → {total_a} ({total_a-total_b:+})")

    view = sb.table("listings_public").select("listing_type,owner_verified").limit(1000).execute().data
    print(f"у каталозі: {len(view)}")
    print("  типи          :", dict(Counter(r["listing_type"] for r in view)))
    print("  owner_verified:", dict(Counter(r["owner_verified"] for r in view)))


if __name__ == "__main__":
    main()
