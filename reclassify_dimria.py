#!/usr/bin/env python3
"""
Переклассифікація наявних dimria-рядків за виправленою логікою
(див. dimria_monitor.parse_seller_type — пряма мітка джерела має пріоритет).

Потрібно, бо виправлення класифікатора саме по собі не чіпає вже збережені рядки.
"""
from collections import Counter

import requests

import config
import dimria_monitor as dm
from supabase import create_client

sb = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
rows = (
    sb.table("listings")
    .select("id,external_id,listing_type,probability_of_owner,ai_reasoning,owner_verified")
    .eq("source", "dimria").limit(1000).execute().data
)

s = requests.Session()
s.headers.update(getattr(dm, "HEADERS", {"User-Agent": "Mozilla/5.0"}))

changed, moves, failed = 0, Counter(), 0
for r in rows:
    realty = dm.fetch_realty(s, int(r["external_id"]))
    if not realty:
        failed += 1
        continue

    new = dm.map_realty_to_row(realty, [])
    old_type, new_type = r["listing_type"], new["listing_type"]
    # Пояснення теж звіряємо: воно і є слідом аудиту, тож застаріле
    # формулювання («agency_id=None») ховає справжню підставу рішення.
    if (
        old_type == new_type
        and r["probability_of_owner"] == new["probability_of_owner"]
        and r.get("ai_reasoning") == new["ai_reasoning"]
        and r.get("owner_verified") == new["owner_verified"]
    ):
        continue

    sb.table("listings").update({
        "listing_type": new_type,
        "probability_of_owner": new["probability_of_owner"],
        "commission": new["commission"],
        "owner_verified": new["owner_verified"],
        "ai_reasoning": new["ai_reasoning"],
    }).eq("id", r["id"]).execute()

    changed += 1
    if old_type != new_type:
        moves[f"{old_type} → {new_type}"] += 1

print(f"оброблено: {len(rows)}, не вдалось дістати: {failed}")
print(f"оновлено рядків: {changed}")
print("зміни типу:", dict(moves) or "немає")
