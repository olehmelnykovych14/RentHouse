#!/usr/bin/env python3
"""Аудит: звіряє listing_type у базі з полем «Пропозиція від...» на dom.ria."""
import sys
from collections import Counter

import requests

import config
import dimria_monitor as dm
from supabase import create_client

LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 40

sb = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
rows = (
    sb.table("listings").select("id,external_id,listing_type,city")
    .eq("source", "dimria").limit(LIMIT).execute().data
)

s = requests.Session()
s.headers.update(getattr(dm, "HEADERS", {"User-Agent": "Mozilla/5.0"}))

seen, mismatch = Counter(), []
for r in rows:
    realty = dm.fetch_realty(s, int(r["external_id"]))
    if not realty:
        continue
    label = dm.parse_seller_type(realty)
    seen[label] += 1
    if label == "посередник" and r["listing_type"] == "owner":
        mismatch.append(r)

print(f"перевірено: {sum(seen.values())} із {len(rows)}")
print("мітка dom.ria:", dict(seen))
print(f"\nПОМИЛКОВО 'owner' (насправді посередник): {len(mismatch)}")
for m in mismatch:
    print(f"  {m['id']}  {m['city']}  realty-{m['external_id']}")
