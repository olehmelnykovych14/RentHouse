#!/usr/bin/env python3
"""
Дописує seller_contact до вже збережених оголошень, розбираючи текст опису.

Навіщо: seller_contact був порожній у 100% рядків, хоча підписка обіцяє саме
«прямий контакт власника», а в тексті телеграм-оголошень номер є у ~93%
випадків. Підписник платив і бачив порожнє поле.

Нічого не завантажує з мережі — працює по вже збережених raw_description.

Без --apply лише показує. Запуск:  python backfill_contacts.py [--apply]
"""
import sys

import config
import listing_fields as lf
from supabase import create_client

APPLY = "--apply" in sys.argv
sb = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)


def main() -> None:
    rows = (
        sb.table("listings")
        .select("id,source,raw_description,clean_description,title,seller_contact")
        .eq("status", "active").limit(5000).execute().data
    )
    todo = [r for r in rows if not r.get("seller_contact")]
    print(f"активних: {len(rows)} | без контакту: {len(todo)}\n")

    found: list[tuple[str, str]] = []
    by_source: dict[str, int] = {}
    for r in todo:
        text = " ".join(
            filter(None, [r.get("raw_description"), r.get("clean_description"), r.get("title")])
        )
        contact = lf.parse_contact(text)
        if contact:
            found.append((r["id"], contact))
            by_source[r["source"]] = by_source.get(r["source"], 0) + 1

    print(f"знайдено контактів: {len(found)}")
    for s, n in sorted(by_source.items()):
        total = sum(1 for r in todo if r["source"] == s)
        print(f"  {s:9} {n:4} / {total:4}")

    if not found:
        return
    if APPLY:
        for i, (lid, contact) in enumerate(found, 1):
            sb.table("listings").update({"seller_contact": contact}).eq("id", lid).execute()
            if i % 50 == 0:
                print(f"  ...{i}/{len(found)}")
        print(f"\nOK: записано {len(found)} контактів")
    else:
        print("\n(dry-run) додай --apply, щоб записати")
        for lid, c in found[:5]:
            print(f"   {c}")


if __name__ == "__main__":
    main()
