#!/usr/bin/env python3
"""
Геокодинг оголошень на рівні РАЙОНУ через OpenStreetMap Nominatim: заповнює
lat/lng для оголошень без координат, щоб показати їх на карті каталогу.

Адреси в скрапленому тексті надто брудні для точного «будинок-у-будинок»
геокодингу, тож ставимо пін у центр району — цього досить, щоб бачити розподіл.
Геокодимо УНІКАЛЬНІ пари (місто, район), а не кожен рядок → ~100 запитів, не 600.

Nominatim: 1 запит/сек, обовʼязковий User-Agent (політика використання).
Запуск:  python geocode_listings.py [--apply]
"""
import sys
import time

import requests

import config
from supabase import create_client

APPLY = "--apply" in sys.argv
sb = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
UA = "RentDirect/1.0 (rental catalog geocoding)"


def geocode(query: str):
    try:
        r = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": query, "format": "json", "limit": 1, "countrycodes": "ua"},
            headers={"User-Agent": UA},
            timeout=20,
        )
        arr = r.json()
        if arr:
            return float(arr[0]["lat"]), float(arr[0]["lon"])
    except Exception as e:
        print(f"  geo err: {e}")
    return None


def main() -> None:
    rows = (
        sb.table("listings").select("id,city,district")
        .eq("status", "active").is_("lat", "null").limit(5000).execute().data
    )
    pairs: dict[tuple[str, str], list[str]] = {}
    for r in rows:
        key = ((r.get("city") or "").strip(), (r.get("district") or "").strip())
        pairs.setdefault(key, []).append(r["id"])

    print(f"без координат: {len(rows)} оголошень | унікальних пар (місто, район): {len(pairs)}\n")

    geocoded_listings = 0
    for (city, district), ids in pairs.items():
        if not city:
            continue
        q = f"{district}, {city}, Україна" if district else f"{city}, Україна"
        coords = geocode(q)
        time.sleep(1.1)  # ліміт Nominatim: 1 запит/сек
        if not coords:
            print(f"  ✗ {q}")
            continue
        lat, lng = coords
        print(f"  ✓ {q} -> {lat:.4f},{lng:.4f} ({len(ids)} оголош.)")
        if APPLY:
            for i in range(0, len(ids), 50):
                sb.table("listings").update({"lat": lat, "lng": lng}).in_("id", ids[i:i + 50]).execute()
        geocoded_listings += len(ids)

    print(f"\nгеокодовано пар: {len(pairs)} | оголошень: {geocoded_listings}")
    if not APPLY:
        print("(dry-run) додай --apply, щоб записати координати")


if __name__ == "__main__":
    main()
