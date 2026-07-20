#!/usr/bin/env python3
"""
DIM.RIA Rental Monitor
Моніторинг dom.ria.com (оренда квартир, фільтр «від власника») через внутрішній JSON API.

Підхід (звірено на живих даних):
  1. Пошук:  GET dom.ria.com/node/searchEngine/v2/?...   → {"count":N, "items":[realty_id,...]}
  2. Деталі: GET dom.ria.com/uk/realty-{id}.html          → window.__INITIAL_STATE__.listing.data.realty
     (сторінка деталей — SSR, віддає повний структурований JSON)
  3. Фото:   cdn.riastatic.com/photos/{file без .jpg}f.jpg

Дані вже структуровані, тому AI-парсинг тексту не потрібен. Класифікація власника —
з нативного прапорця `isOwner` + `agency_id` (надійніше за вгадування по тексту).
УВАГА: фільтр «від власника» на dom.ria все одно пропускає агенції (isOwner=False +
agency_id), тому ми перевіряємо isOwner самі.
"""

import json
import time
import random
import logging
import re
import os
from pathlib import Path

import requests
from supabase import create_client

try:
    import config
except ImportError:
    config = None


def get_secret(name: str, default: str = "") -> str:
    if config is not None and hasattr(config, name):
        return getattr(config, name)
    return os.getenv(name, default)


# ─────────────────────────────────────────────
# КОНФІГУРАЦІЯ
# ─────────────────────────────────────────────
SUPABASE_URL = get_secret("SUPABASE_URL")
SUPABASE_SERVICE_KEY = get_secret("SUPABASE_SERVICE_KEY")

CITY = "Львів"   # запасне значення; реальне місто береться з даних оголошення
SUPABASE_BUCKET = "listing-photos"
MAX_PHOTOS = 15

# Міста для моніторингу (state_id/city_id з dom.ria; в обласних центрів вони збігаються).
MONITOR_CITIES = [
    {"name": "Київ", "state_id": 10, "city_id": 10},
    {"name": "Львів", "state_id": 5, "city_id": 5},
    {"name": "Одеса", "state_id": 12, "city_id": 12},
    {"name": "Дніпро", "state_id": 11, "city_id": 11},
    {"name": "Харків", "state_id": 22, "city_id": 22},
    {"name": "Вінниця", "state_id": 1, "city_id": 1},
    {"name": "Тернопіль", "state_id": 3, "city_id": 3},
    {"name": "Івано-Франківськ", "state_id": 15, "city_id": 15},
    {"name": "Запоріжжя", "state_id": 14, "city_id": 14},
    {"name": "Полтава", "state_id": 20, "city_id": 20},
]

SEARCH_API = "https://dom.ria.com/node/searchEngine/v2/"
DETAIL_URL_TMPL = "https://dom.ria.com/uk/realty-{}.html"
CDN_BASE = "https://cdn.riastatic.com/photos/"

# Параметри пошуку = URL з фільтром «від власника» для Львова, довгострокова оренда.
# ch=242_239,246_244 — фільтр власника; state_id/city_id=5 — Львів; operation_type=3 — оренда.
SEARCH_PARAMS = {
    "category": 1,
    "realty_type": 2,
    "operation_type": 3,
    "ch": "242_239,246_244",
    "excludeSold": 1,
    "limit": 20,
}

SEEN_ADS_FILE = Path("seen_ads_dimria.json")
MAX_PAGES = 3

PAUSE_BETWEEN_REQUESTS = (4, 9)
CYCLE_PAUSE = (300, 480)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
]

# ─────────────────────────────────────────────
# ІНІЦІАЛІЗАЦІЯ
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("dimria_monitor.log", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY) if SUPABASE_URL and SUPABASE_SERVICE_KEY else None

_STATE_RE = re.compile(r"window\.__INITIAL_STATE__\s*=\s*(\{.*?\});", re.DOTALL)
_CURRENCY = {"$": "USD", "€": "EUR", "₴": "UAH", "грн": "UAH"}


# ─────────────────────────────────────────────
# УТИЛІТИ
# ─────────────────────────────────────────────
def load_seen_ads() -> set:
    if SEEN_ADS_FILE.exists():
        try:
            return set(json.loads(SEEN_ADS_FILE.read_text(encoding="utf-8")))
        except Exception:
            pass
    return set()


def save_seen_ads(seen: set) -> None:
    SEEN_ADS_FILE.write_text(json.dumps(list(seen), ensure_ascii=False, indent=2), encoding="utf-8")


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "User-Agent": random.choice(USER_AGENTS),
        "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.7",
        "Referer": "https://dom.ria.com/",
    })
    return session


def stealth_sleep(min_s: float, max_s: float) -> None:
    time.sleep(random.uniform(min_s, max_s))


# ─────────────────────────────────────────────
# ПОШУК + ДЕТАЛІ
# ─────────────────────────────────────────────
def fetch_ids(session: requests.Session, page: int, city: dict) -> tuple[list[int], int]:
    """Повертає (список realty_id, загальна кількість) для сторінки пошуку в місті."""
    try:
        params = {**SEARCH_PARAMS, "state_id": city["state_id"], "city_id": city["city_id"], "page": page}
        resp = session.get(SEARCH_API, params=params, timeout=20)
        resp.raise_for_status()
        data = resp.json()
        return data.get("items", []), data.get("count", 0)
    except Exception as e:
        log.warning(f"Пошук (стор. {page}) не вдався: {e}")
        return [], 0


def fetch_realty(session: requests.Session, realty_id: int) -> dict | None:
    """Тягне сторінку деталей і витягує об'єкт realty з __INITIAL_STATE__."""
    try:
        resp = session.get(DETAIL_URL_TMPL.format(realty_id), timeout=20)
        resp.raise_for_status()
    except Exception as e:
        log.warning(f"Деталі {realty_id} не завантажились: {e}")
        return None

    m = _STATE_RE.search(resp.text)
    if not m:
        log.warning(f"{realty_id}: __INITIAL_STATE__ не знайдено")
        return None
    try:
        state = json.loads(m.group(1))
        return state["listing"]["data"]["realty"]
    except Exception as e:
        log.warning(f"{realty_id}: не розпарсив state ({e})")
        return None


def build_photo_urls(realty: dict) -> list[str]:
    """Будує повнорозмірні URL фото з photos[].file → cdn.../{file}f.jpg."""
    urls = []
    for p in realty.get("photos", [])[:MAX_PHOTOS]:
        f = p.get("file", "")
        if f.endswith(".jpg"):
            f = f[:-4]
        if f:
            urls.append(f"{CDN_BASE}{f}f.jpg")
    return urls


# Маркери прихованого ріелтора в тексті: dom.ria не завжди має agency_id, але
# приватно-розміщені посередники видають себе лексикою. Такі → агенція.
REALTOR_MARKERS = [
    "ріелтор", "рієлтор", "ріэлтор", "маклер", "агенц", "агентство",
    "комісія", "коммисия", "% від", "код об", "без комісії", "код объ",
]


def looks_like_realtor(text: str) -> bool:
    t = (text or "").lower()
    return any(m in t for m in REALTOR_MARKERS)


def parse_uah_price(realty: dict) -> int | None:
    """Точна ціна в гривнях із priceObj dom.ria (напр. '40 545' → 40545)."""
    raw = str((realty.get("priceObj") or {}).get("priceUAH", "")).replace(" ", "").replace(" ", "")
    try:
        return int(raw) if raw.isdigit() else None
    except Exception:
        return None


def map_realty_to_row(realty: dict, photos: list[str]) -> dict:
    """Мапить структурований об'єкт dom.ria у рядок таблиці listings."""
    description = realty.get("description_uk") or realty.get("description") or ""
    # Власник ↔ агенція: немає agency_id І немає ріелторської лексики в описі.
    is_owner = not realty.get("agency_id") and not looks_like_realtor(description)
    rooms = realty.get("rooms_count")
    district = realty.get("district_name_uk") or realty.get("district_name")

    return {
        "source": "dimria",
        "external_id": str(realty.get("realty_id")),
        "url": realty.get("absoluteUrl") or DETAIL_URL_TMPL.format(realty.get("realty_id")),
        "title": (f"{rooms}-кімнатна квартира, {district}" if rooms else "Квартира") ,
        "raw_description": description,
        "clean_description": description,   # структуровано; AI-очистку можна додати пізніше
        "price": realty.get("price_total") or realty.get("price"),
        "currency": _CURRENCY.get(realty.get("currency_type"), "UAH"),
        "price_uah": parse_uah_price(realty),
        "rooms": rooms,
        "district": district,
        "city": realty.get("city_name_uk") or CITY,
        "has_furniture": None,
        "area_sqm": realty.get("total_square_meters"),
        "floor": realty.get("floor"),
        "total_floors": realty.get("floors_count"),
        "property_type": "apartment",
        "residential_complex": realty.get("newbuild_name_uk"),
        "lat": realty.get("latitude"),
        "lng": realty.get("longitude"),
        # Класифікація з нативного прапорця dom.ria, не з тексту
        "listing_type": "owner" if is_owner else "agency",
        "commission": None,
        "commission_verified": False,
        "photos": photos,
        "probability_of_owner": 90 if is_owner else 15,
        "ai_reasoning": f"DIM.RIA: {'власник' if is_owner else 'агенція'} (agency_id={realty.get('agency_id')})",
        "seller_name": "",
    }


# ─────────────────────────────────────────────
# SUPABASE + STORAGE
# ─────────────────────────────────────────────
def upload_photos_to_storage(session: requests.Session, photo_urls: list[str], ad_id: str) -> list[str]:
    if not photo_urls:
        return []
    if supabase is None:
        return photo_urls
    public_urls = []
    for i, url in enumerate(photo_urls[:MAX_PHOTOS]):
        try:
            resp = session.get(url, timeout=20)
            resp.raise_for_status()
            path = f"dimria/{ad_id}/{i}.jpg"
            supabase.storage.from_(SUPABASE_BUCKET).upload(
                path, resp.content, {"content-type": "image/jpeg", "upsert": "true"}
            )
            public_urls.append(supabase.storage.from_(SUPABASE_BUCKET).get_public_url(path))
        except Exception as e:
            log.warning(f"  ⚠️ Фото {i} не завантажилось ({e}), лишаю сирий URL")
            public_urls.append(url)
    return public_urls


def upsert_listing(row: dict) -> None:
    if supabase is None:
        return
    try:
        supabase.table("listings").upsert(row, on_conflict="source,external_id").execute()
    except Exception as e:
        log.error(f"  ⚠️ Supabase upsert не вдався: {e}")


# ─────────────────────────────────────────────
# ГОЛОВНИЙ ЦИКЛ
# ─────────────────────────────────────────────
def process_id(session: requests.Session, realty_id: int, seen: set) -> None:
    ad_id = str(realty_id)
    if ad_id in seen:
        return

    stealth_sleep(*PAUSE_BETWEEN_REQUESTS)
    session.headers.update({"User-Agent": random.choice(USER_AGENTS)})

    realty = fetch_realty(session, realty_id)
    seen.add(ad_id)
    if not realty:
        return

    photos = upload_photos_to_storage(session, build_photo_urls(realty), ad_id)
    row = map_realty_to_row(realty, photos)
    log.info(f"  ✓ {row['listing_type']} | {row['rooms']}к | {row['price']}{row['currency']} | {row['district']} | фото {len(photos)}")
    upsert_listing(row)


def run_monitor():
    log.info("=" * 60)
    log.info("🏠 DIM.RIA Monitor — старт")
    log.info("=" * 60)

    seen = load_seen_ads()
    log.info(f"Завантажено {len(seen)} вже оброблених оголошень")

    cycle = 0
    while True:
        cycle += 1
        log.info(f"\n🔄 Цикл #{cycle}")
        session = make_session()

        for city in MONITOR_CITIES:
            log.info(f"\n🏙️ {city['name']}")
            for page in range(0, MAX_PAGES):
                ids, count = fetch_ids(session, page, city)
                if page == 0:
                    log.info(f"🔎 {city['name']}: {count} оголошень від власника (до {MAX_PAGES} стор.)")
                if not ids:
                    break
                for realty_id in ids:
                    process_id(session, realty_id, seen)

        save_seen_ads(seen)
        pause = random.uniform(*CYCLE_PAUSE)
        log.info(f"⏱️ Наступний цикл через {pause/60:.1f} хв...")
        time.sleep(pause)


if __name__ == "__main__":
    run_monitor()
