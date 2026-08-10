#!/usr/bin/env python3
"""
Добирає ФОТО для вже збережених OLX-оголошень.

Старий екстрактор брав лише og:image (1 фото), бо галерея OLX рендериться JS-ом.
Виправлення в olx_monitor_1 діє тільки на нові оголошення — цей скрипт
перезабирає сторінку наявних і дописує всі фото.

Побічна користь: сторінка, якої вже немає (404/410), позначається expired —
таке оголошення все одно неактуальне.

Без --apply лише показує. Запуск:
    python backfill_olx_photos.py [--apply] [--limit N] [--all]
        --all   не лише каталожні (owner≥70 / agency_no_fee), а всі OLX
"""
import sys
import time

import requests
from bs4 import BeautifulSoup

import config
import olx_monitor_1 as olx
from supabase import create_client

APPLY = "--apply" in sys.argv
ALL = "--all" in sys.argv
LIMIT = 500
if "--limit" in sys.argv:
    try:
        LIMIT = int(sys.argv[sys.argv.index("--limit") + 1])
    except (IndexError, ValueError):
        pass

sb = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
})


def main() -> None:
    q = sb.table("listings").select("id,url,title,photos,external_id").eq("source", "olx").eq("status", "active")
    if not ALL:
        # Спершу ті, що реально бачить користувач.
        q = q.or_("and(listing_type.eq.owner,probability_of_owner.gte.70),listing_type.eq.agency_no_fee")
    rows = q.limit(LIMIT).execute().data
    targets = [r for r in rows if len(r.get("photos") or []) <= 1]
    print(f"OLX активних: {len(rows)} | з ≤1 фото: {len(targets)}\n")

    fixed = dead = 0
    for r in targets:
        try:
            resp = session.get(r["url"], timeout=25)
        except Exception as e:
            print(f"  ✗ мережа: {e}")
            continue

        if resp.status_code in (404, 410):
            dead += 1
            print(f"  ✝ {resp.status_code} — знято: {(r['title'] or '')[:45]}")
            if APPLY:
                sb.table("listings").update({"status": "expired"}).eq("id", r["id"]).execute()
            time.sleep(0.5)
            continue

        soup = BeautifulSoup(resp.text, "html.parser")
        photos = olx._extract_photo_urls(soup, resp.text)
        if len(photos) <= 1:
            print(f"  – без змін ({len(photos)} фото): {(r['title'] or '')[:45]}")
            time.sleep(0.5)
            continue

        print(f"  ✓ {len(photos)} фото: {(r['title'] or '')[:45]}")
        if APPLY:
            stored = olx.upload_photos_to_storage(session, photos, r.get("external_id") or r["id"])
            sb.table("listings").update({"photos": stored}).eq("id", r["id"]).execute()
        fixed += 1
        time.sleep(0.6)  # не гатимо OLX

    print(f"\nдодано фото: {fixed} | знято мертвих: {dead}")
    if not APPLY:
        print("(dry-run) додай --apply, щоб записати")


if __name__ == "__main__":
    main()
