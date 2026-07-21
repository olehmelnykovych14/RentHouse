#!/usr/bin/env python3
"""
Прибирає з бази не-орендні пости, які потрапили туди через бекфіл до появи
воротаря post_type (продаж, запити «шукаю житло», реклама), і дублі-крос-пости.

Без --apply лише показує, що буде видалено.
"""
import re
import sys
from collections import defaultdict

import config
import telegram_parser as tp
from supabase import create_client

APPLY = "--apply" in sys.argv

sb = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
rows = (
    sb.table("listings").select("id,title,raw_description,price_uah,url,created_at")
    .eq("source", "telegram").limit(1000).execute().data
)

# Перевіряємо той самий текст тим самим AI, що й воротар — щоб рішення
# про видалення збігалося з рішенням про запис.
to_delete: list[tuple[dict, str]] = []
keep: list[dict] = []
for r in rows:
    text = r.get("raw_description") or ""
    extraction = tp.ai_check(text)
    reason = tp.reject_reason(extraction)
    if reason:
        to_delete.append((r, reason))
    else:
        keep.append(r)

# Дублі: той самий текст, розісланий у кілька каналів, дає різні external_id.
# Ключ — нормалізований текст; лишаємо найстаріший запис.
def norm(t: str) -> str:
    return re.sub(r"\W+", "", (t or "").lower())[:300]

groups: dict[str, list[dict]] = defaultdict(list)
for r in keep:
    groups[norm(r.get("raw_description"))].append(r)

dupes = []
for _, group in groups.items():
    if len(group) > 1:
        group.sort(key=lambda x: x["created_at"])
        dupes.extend(group[1:])

print(f"всього telegram-рядків: {len(rows)}")
print(f"\nНЕ оренда ({len(to_delete)}):")
for r, reason in to_delete:
    print(f"  [{reason}] {(r['title'] or '')[:60]}")

print(f"\nДублі-крос-пости ({len(dupes)}):")
for r in dupes:
    print(f"  {(r['title'] or '')[:60]}")

remaining = len(rows) - len(to_delete) - len(dupes)
print(f"\nЗалишиться справжніх орендних оголошень: {remaining}")

if not APPLY:
    print("\n(пробний прогін — нічого не видалено; додай --apply)")
    sys.exit()

ids = [r["id"] for r, _ in to_delete] + [r["id"] for r in dupes]
for i in ids:
    sb.table("listings").delete().eq("id", i).execute()
print(f"\nВидалено: {len(ids)}")
