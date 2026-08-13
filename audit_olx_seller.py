#!/usr/bin/env python3
"""Аудит: звіряє listing_type у базі з міткою OLX «бізнес / приватна особа»."""
from collections import Counter

import config
import olx_monitor_1 as om
from supabase import create_client

sb = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
rows = (
    sb.table("listings").select("id,url,listing_type,probability_of_owner,city")
    .eq("source", "olx").limit(500).execute().data
)

s = om.make_session()
seen, wrong_owner, unknown = Counter(), [], 0

for r in rows:
    resp = om.safe_get(s, r["url"])
    if not resp:
        unknown += 1
        continue
    flag = om.parse_is_business(resp.text)
    seen[{True: "бізнес", False: "приватна особа"}.get(flag, "невідомо")] += 1
    if flag is True and r["listing_type"] == "owner":
        wrong_owner.append(r)
    om.stealth_sleep(1, 2)

print(f"перевірено: {sum(seen.values())} із {len(rows)} (не відкрилось: {unknown})")
print("мітка OLX:", dict(seen))
print(f"\nПОМИЛКОВО 'owner' (OLX каже бізнес): {len(wrong_owner)}")
for w in wrong_owner:
    print(f"  {w['id']}  {w['city']}  {w['url'][:80]}")
