#!/usr/bin/env python3
"""
Прибирає дублі-оголошення: той самий текст, розісланий у кілька джерел/каналів
(так масово роблять агенції), дає різні рядки. Лишаємо один, решту знімаємо.

Сигнал навмисно консервативний — нормалізований текст опису має ЗБІГАТИСЯ. Різні
описи тієї самої квартири на OLX і в Telegram сюди не потраплять (і добре: краще
лишити зайвий дубль, ніж злити дві різні квартири). Додатковий запобіжник:
збіг ціни, щоб однаковий шаблон-текст на різні квартири не склеївся.

Кого лишаємо в групі: спершу видиме в каталозі (owner≥70 / agency_no_fee),
потім найстаріше. Решту → status=removed (оборотно).

Без --apply лише показує. Запуск:  python dedupe_listings.py [--apply]
"""
import re
import sys
from collections import defaultdict

import config
from supabase import create_client

APPLY = "--apply" in sys.argv
sb = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)


def norm(t: str) -> str:
    return re.sub(r"\W+", "", (t or "").lower())[:300]


def catalog_rank(r: dict) -> int:
    """Що показуємо в каталозі — лишаємо охочіше (менше = кращий кандидат)."""
    lt = r.get("listing_type")
    if lt == "owner" and (r.get("probability_of_owner") or 0) >= 70:
        return 0
    if lt == "agency_no_fee":
        return 1
    return 2


def main() -> None:
    rows = (
        sb.table("listings")
        .select("id,source,raw_description,price_uah,listing_type,probability_of_owner,created_at,title")
        .eq("status", "active").limit(5000).execute().data
    )

    # Ключ дубля: нормалізований текст + ціна (щоб шаблон на різні квартири не злити).
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for r in rows:
        text = norm(r.get("raw_description") or r.get("title"))
        if len(text) < 40:  # надто короткий текст — ненадійно, пропускаємо
            continue
        groups[(text, r.get("price_uah"))].append(r)

    to_remove: list[dict] = []
    dupe_groups = 0
    for _, g in groups.items():
        if len(g) < 2:
            continue
        dupe_groups += 1
        # Лишаємо найкращий для каталогу, серед рівних — найстаріший.
        g.sort(key=lambda r: (catalog_rank(r), r["created_at"]))
        keep, extras = g[0], g[1:]
        srcs = ", ".join(sorted({r["source"] for r in g}))
        print(f"── дубль ×{len(g)} [{srcs}] лишаю {keep['source']}:{keep['id'][:8]} — {(keep['title'] or '')[:45]}")
        to_remove.extend(extras)

    print(f"\nдубль-груп: {dupe_groups} | зайвих копій: {len(to_remove)}")
    if not to_remove:
        return

    if APPLY:
        ids = [r["id"] for r in to_remove]
        for i in range(0, len(ids), 50):
            sb.table("listings").update({"status": "removed"}).in_("id", ids[i:i + 50]).execute()
        print(f"✅ знято {len(ids)} дублів (status=removed)")
    else:
        print("(dry-run) додай --apply, щоб зняти дублі")


if __name__ == "__main__":
    main()
