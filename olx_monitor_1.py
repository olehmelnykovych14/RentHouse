#!/usr/bin/env python3
"""
OLX Real Estate Owner Detector
Моніторинг OLX.ua для виявлення реальних власників квартир.
"""

import json
import time
import random
import logging
import re
import os
from datetime import datetime
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from openai import OpenAI
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
# КОНФІГУРАЦІЯ — заповніть свої дані
# ─────────────────────────────────────────────
TELEGRAM_BOT_TOKEN = get_secret("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_IDS = [
    cid for cid in [
        get_secret("TELEGRAM_CHAT_ID_1"),
        get_secret("TELEGRAM_CHAT_ID_2"),
    ] if cid
]
OPENAI_API_KEY = get_secret("OPENAI_API_KEY")
SUPABASE_URL = get_secret("SUPABASE_URL")
SUPABASE_SERVICE_KEY = get_secret("SUPABASE_SERVICE_KEY")

# URL-и для моніторингу (продаж + оренда квартир у Львові — змініть під своє місто)
OLX_BASE = "https://www.olx.ua/uk/nedvizhimost/kvartiry/dolgosrochnaya-arenda-kvartir"

# Міста для моніторингу. Місто береться з джерела й пишеться в рядок оголошення.
MONITOR_SOURCES = [
    {"city": "Київ", "url": f"{OLX_BASE}/kiev/"},
    {"city": "Львів", "url": f"{OLX_BASE}/lvov/"},
    {"city": "Одеса", "url": f"{OLX_BASE}/odessa/"},
    {"city": "Дніпро", "url": f"{OLX_BASE}/dnepr/"},
    {"city": "Харків", "url": f"{OLX_BASE}/harkov/"},
    {"city": "Вінниця", "url": f"{OLX_BASE}/vinnica/"},
    {"city": "Тернопіль", "url": f"{OLX_BASE}/ternopol/"},
    {"city": "Івано-Франківськ", "url": f"{OLX_BASE}/ivano-frankovsk/"},
    {"city": "Запоріжжя", "url": f"{OLX_BASE}/zaporozhe/"},
    {"city": "Полтава", "url": f"{OLX_BASE}/poltava/"},
]

CITY = "Львів"   # запасне значення, якщо джерело не вказало місто

SUPABASE_BUCKET = "listing-photos"   # публічний bucket у Supabase Storage
MAX_PHOTOS      = 15                  # скільки фото зберігати на оголошення

# Приблизні курси для нормалізації ціни в гривні (для фільтрів/сортування).
FX_TO_UAH = {"UAH": 1, "USD": 41, "EUR": 44}


def to_uah(price, currency) -> int | None:
    if price is None:
        return None
    rate = FX_TO_UAH.get((currency or "UAH").upper())
    return round(price * rate) if rate else None

SEEN_ADS_FILE  = Path("seen_ads.json")
MIN_OWNER_PROB = 70   # Мінімальний % щоб відправити в Telegram

# Пагінація
MAX_PAGES = 3                    # Скільки сторінок сканувати (1–N)
PAUSE_BETWEEN_PAGES = (5, 12)   # Пауза між сторінками (секунди)

# Інтервали (секунди)
PAUSE_BETWEEN_REQUESTS = (10, 20)
CYCLE_PAUSE            = (300, 480)   # 5–8 хвилин між циклами

# ─────────────────────────────────────────────
# РІВЕНЬ 1 — ТЕХНІЧНИЙ БАН
# ─────────────────────────────────────────────
BANNED_NAME_SUBSTRINGS = [
   # "АН", "агентство", "realty", "agency", "expert",
   # "нерухомість", "офіс", "ріелтор", "realtor",
   # "estate", "invest", "propert",
]

MAX_ACTIVE_LISTINGS = 1  # > цього числа → посередник

# ─────────────────────────────────────────────
# РІВЕНЬ 2 — СТОП-СЛОВА
# ─────────────────────────────────────────────
HARD_STOP_WORDS = [
  #  "відео в приват", "ключі на руках", "дизайн-проект у подарунок",
  #  "запрошую на огляд", "комісія", "ріелтор", "агент",
   # "без комісії агента", "торг доречний після огляду",
   # "звертайтесь", "залишайте заявку", "дзвоніть",
   # "підберу варіант", "є ще варіанти", "база нерухомості",
]

# ─────────────────────────────────────────────
# USER-AGENT ПУЛ (Рівень 4)
# ─────────────────────────────────────────────
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
]

# ─────────────────────────────────────────────
# ІНІЦІАЛІЗАЦІЯ
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("olx_monitor.log", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)

openai_client = OpenAI(api_key=OPENAI_API_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY) if SUPABASE_URL and SUPABASE_SERVICE_KEY else None


# ─────────────────────────────────────────────
# УТИЛІТИ
# ─────────────────────────────────────────────

def load_seen_ads() -> set:
    if SEEN_ADS_FILE.exists():
        try:
            data = json.loads(SEEN_ADS_FILE.read_text(encoding="utf-8"))
            return set(data)
        except Exception:
            pass
    return set()


def save_seen_ads(seen: set) -> None:
    SEEN_ADS_FILE.write_text(
        json.dumps(list(seen), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "User-Agent": random.choice(USER_AGENTS),
        "Accept-Language": "uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Referer": "https://www.olx.ua/",
    })
    return session


def safe_get(session: requests.Session, url: str, retries: int = 3) -> requests.Response | None:
    for attempt in range(1, retries + 1):
        try:
            resp = session.get(url, timeout=20)
            resp.raise_for_status()
            return resp
        except (requests.ConnectionError, requests.exceptions.ConnectionError) as e:
            log.warning(f"ConnectionError (спроба {attempt}/{retries}): {e}")
        except requests.HTTPError as e:
            log.warning(f"HTTP {e.response.status_code} для {url}")
            if e.response.status_code in (403, 404):
                return None
        except Exception as e:
            log.warning(f"Невідома помилка (спроба {attempt}/{retries}): {e}")

        if attempt < retries:
            sleep = random.uniform(15, 30) * attempt
            log.info(f"Пауза {sleep:.0f}с перед повторною спробою...")
            time.sleep(sleep)

    log.error(f"Усі {retries} спроби вичерпано для: {url}")
    return None


def stealth_sleep(min_s: float, max_s: float) -> None:
    delay = random.uniform(min_s, max_s)
    log.debug(f"Пауза {delay:.1f}с...")
    time.sleep(delay)


# ─────────────────────────────────────────────
# ПАРСИНГ СПИСКУ ОГОЛОШЕНЬ
# ─────────────────────────────────────────────

def _build_page_url(base_url: str, page: int) -> str:
    """
    Будує URL для конкретної сторінки OLX.
    Сторінка 1 — оригінальний URL (без параметра).
    Сторінка 2+ — додає ?page=N або &page=N.
    """
    if page <= 1:
        return base_url
    separator = "&" if "?" in base_url else "?"
    return f"{base_url}{separator}page={page}"


def _parse_ads_from_page(soup: BeautifulSoup, page_num: int) -> list[dict]:
    """Витягує оголошення з вже розпарсеної сторінки."""
    ads = []
    for card in soup.select('[data-cy="l-card"]'):
        a_tag = card.select_one("a[href]")
        if not a_tag:
            continue
        href = a_tag["href"]
        if not href.startswith("http"):
            href = "https://www.olx.ua" + href
        title_tag = card.select_one("h4, h3, [data-testid='ad-title']")
        title = title_tag.get_text(strip=True) if title_tag else "Без назви"
        ads.append({"url": href, "title": title, "page": page_num})
    return ads


def _has_next_page(soup: BeautifulSoup) -> bool:
    """Перевіряє чи є кнопка 'Наступна сторінка' на поточній сторінці."""
    next_btn = (
        soup.select_one('[data-testid="pagination-forward"]')
        or soup.select_one('a[data-cy="pagination-forward"]')
        or soup.select_one('a[aria-label*="Наступна"]')
        or soup.select_one('a[aria-label*="Next"]')
    )
    return next_btn is not None


def fetch_listing_urls(session: requests.Session, base_url: str) -> list[dict]:
    """
    Повертає список {url, title, page} з усіх сторінок (до MAX_PAGES).
    Зупиняється раніше якщо OLX повідомляє що наступної сторінки немає.
    """
    all_ads: list[dict] = []

    for page_num in range(1, MAX_PAGES + 1):
        page_url = _build_page_url(base_url, page_num)
        log.info(f"  📄 Сторінка {page_num}/{MAX_PAGES}: {page_url}")

        session.headers.update({"User-Agent": random.choice(USER_AGENTS)})

        resp = safe_get(session, page_url)
        if not resp:
            log.warning(f"  ⚠️ Не вдалось завантажити сторінку {page_num}, зупиняємось")
            break

        soup = BeautifulSoup(resp.text, "html.parser")
        page_ads = _parse_ads_from_page(soup, page_num)

        if not page_ads:
            log.info(f"  ℹ️ Сторінка {page_num} порожня — зупиняємось")
            break

        all_ads.extend(page_ads)
        log.info(f"  ✓ Знайдено {len(page_ads)} оголошень (всього: {len(all_ads)})")

        # Якщо немає наступної сторінки — не йдемо далі
        if page_num < MAX_PAGES and not _has_next_page(soup):
            log.info(f"  ℹ️ Наступної сторінки немає, завершуємо на {page_num}")
            break

        # Пауза між сторінками (stealth)
        if page_num < MAX_PAGES:
            stealth_sleep(*PAUSE_BETWEEN_PAGES)

    log.info(f"📦 Всього зібрано {len(all_ads)} оголошень з {base_url}")
    return all_ads


# ─────────────────────────────────────────────
# ПАРСИНГ ОКРЕМОГО ОГОЛОШЕННЯ
# ─────────────────────────────────────────────

def fetch_ad_details(session: requests.Session, ad_url: str) -> dict | None:
    """Парсить деталі оголошення. Повертає None якщо не вдалося."""
    resp = safe_get(session, ad_url)
    if not resp:
        return None

    soup = BeautifulSoup(resp.text, "html.parser")

    # Назва
    title_tag = soup.select_one("h1")
    title = title_tag.get_text(strip=True) if title_tag else "Без назви"

    # Опис
    desc_tag = soup.select_one('[data-cy="ad_description"]') or soup.select_one(".descriptioncontent")
    description = desc_tag.get_text(" ", strip=True) if desc_tag else ""

    # Ім'я/нік продавця
    seller_tag = (
        soup.select_one('[data-testid="user-profile-link"]')
        or soup.select_one(".userdetails strong")
        or soup.select_one('[class*="userName"]')
    )
    seller_name = seller_tag.get_text(strip=True) if seller_tag else ""

    # Кількість оголошень автора (None = на сторінці немає)
    other_ads_count = _extract_seller_ads_count(soup)

    # Пряма мітка OLX: бізнес-акаунт чи приватна особа
    is_business = parse_is_business(resp.text)

    # Фото оголошення (сирі URL з CDN OLX)
    photo_urls = _extract_photo_urls(soup)

    # Дата реєстрації продавця (якщо є)
    reg_date = ""
    for span in soup.find_all("span"):
        text = span.get_text(strip=True)
        if "на OLX з" in text or "member since" in text.lower():
            reg_date = text
            break

    return {
        "url": ad_url,
        "title": title,
        "description": description,
        "seller_name": seller_name,
        "seller_ads_count": other_ads_count,
        "is_business": is_business,
        "reg_date": reg_date,
        "photo_urls": photo_urls,
    }


def _extract_photo_urls(soup: BeautifulSoup) -> list[str]:
    """Витягує URL фотографій оголошення з галереї OLX (до MAX_PHOTOS, без дублів)."""
    urls: list[str] = []

    candidates = (
        soup.select('img[data-testid="swiper-image"]')
        or soup.select(".swiper-slide img")
        or soup.select('[data-cy="adPhotos-swiperSlide"] img')
    )

    for img in candidates:
        # srcset дає найбільшу роздільність — беремо останній варіант
        src = ""
        srcset = img.get("srcset")
        if srcset:
            src = srcset.split(",")[-1].strip().split(" ")[0]
        if not src:
            src = img.get("src", "")
        if src.startswith("http") and ("olxcdn" in src or "apollo" in src) and src not in urls:
            urls.append(src)

    # Резерв: og:image, якщо галерею не знайшли
    if not urls:
        for meta in soup.select('meta[property="og:image"]'):
            src = meta.get("content", "")
            if src.startswith("http") and src not in urls:
                urls.append(src)

    return urls[:MAX_PHOTOS]


def _extract_seller_ads_count(soup: BeautifulSoup) -> int | None:
    """
    Кількість активних оголошень продавця, або None якщо її на сторінці немає.

    ВАЖЛИВО: None ≠ 0. Раніше функція повертала 0 при невдачі, і через це
    `0 > MAX_ACTIVE_LISTINGS` ніколи не спрацьовувало — бан за кількістю
    оголошень мовчки пропускав усіх, а в промпт AI йшло «активних оголошень: 0»,
    що робило будь-якого ріелтора схожим на власника з єдиним оголошенням.
    Сторінка оголошення зазвичай числа НЕ містить (лише лінк «Усі оголошення автора»).
    """
    text = soup.get_text(" ")
    for pat in (r"(\d+)\s*оголошен", r"(\d+)\s*активн"):
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return int(m.group(1))
    return None


# OLX сам позначає, чи акаунт бізнесовий. Це пряма заява джерела — надійніша
# за будь-яке вгадування по тексту (те саме, що charId 1437 у dom.ria).
_IS_BUSINESS_RE = re.compile(r'\\?"isBusiness\\?"\s*:\s*(true|false)')


def parse_is_business(html: str) -> bool | None:
    """True — бізнес-акаунт, False — приватна особа, None — сигналу немає."""
    m = _IS_BUSINESS_RE.search(html or "")
    if m:
        return m.group(1) == "true"
    if "Приватна особа" in (html or ""):
        return False
    return None


# ─────────────────────────────────────────────
# РІВЕНЬ 1: ТЕХНІЧНИЙ БАН
# ─────────────────────────────────────────────

def level1_technical_ban(ad: dict) -> tuple[bool, str]:
    """True = БАН."""
    name_lower = ad["seller_name"].lower()

    for substr in BANNED_NAME_SUBSTRINGS:
        if substr.lower() in name_lower:
            return True, f"Назва профілю містить '{substr}'"

    # Пряма мітка OLX має пріоритет над усіма здогадами.
    if ad.get("is_business") is True:
        return True, "OLX позначив акаунт як бізнес"

    count = ad.get("seller_ads_count")
    if count is not None and count > MAX_ACTIVE_LISTINGS:
        return True, f"Забагато оголошень: {count} > {MAX_ACTIVE_LISTINGS}"

    return False, ""


# ─────────────────────────────────────────────
# РІВЕНЬ 2: СТОП-СЛОВА
# ─────────────────────────────────────────────

def level2_stop_words(ad: dict) -> tuple[bool, str]:
    """True = БАН."""
    text = (ad["title"] + " " + ad["description"]).lower()
    for word in HARD_STOP_WORDS:
        if word.lower() in text:
            return True, f"Стоп-слово: '{word}'"
    return False, ""


# ─────────────────────────────────────────────
# РІВЕНЬ 3: AI-АНАЛІЗ + СТРУКТУРОВАНЕ ВИТЯГУВАННЯ
# ─────────────────────────────────────────────

LISTING_JSON_SCHEMA = {
    "name": "listing_extraction",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "probability_of_owner": {"type": "integer", "description": "0-100"},
            "reasoning": {"type": "string", "description": "Стисле пояснення до 150 слів"},
            "price": {"type": ["number", "null"]},
            "currency": {"type": ["string", "null"], "enum": ["UAH", "USD", "EUR", None]},
            "rooms": {"type": ["integer", "null"]},
            "district": {"type": ["string", "null"], "description": "Район міста, якщо згадується в тексті"},
            "has_furniture": {"type": ["boolean", "null"]},
            "area_sqm": {"type": ["number", "null"], "description": "Площа в м², якщо вказана"},
            "floor": {"type": ["integer", "null"], "description": "Поверх квартири"},
            "total_floors": {"type": ["integer", "null"], "description": "Поверховість будинку"},
            "property_type": {
                "type": ["string", "null"],
                "enum": ["apartment", "house", "room", "studio", None],
                "description": "Тип житла",
            },
            "residential_complex": {"type": ["string", "null"], "description": "Назва ЖК, якщо згадується"},
            "commission": {
                "type": ["string", "null"],
                "description": "Комісія посередника як у тексті: '0%', 'без комісії', '50%', '1000 грн'. null — не згадано",
            },
            "clean_description": {
                "type": "string",
                "description": "Опис переписаний без рекламних штампів, посилань на агентство та закликів звертатись",
            },
        },
        "required": [
            "probability_of_owner", "reasoning", "price", "currency",
            "rooms", "district", "has_furniture", "area_sqm", "floor",
            "total_floors", "property_type", "residential_complex", "commission", "clean_description",
        ],
        "additionalProperties": False,
    },
}

DEFAULT_EXTRACTION = {
    "probability_of_owner": 50,
    "reasoning": "Не вдалось отримати оцінку AI",
    "price": None,
    "currency": None,
    "rooms": None,
    "district": None,
    "has_furniture": None,
    "area_sqm": None,
    "floor": None,
    "total_floors": None,
    "property_type": None,
    "residential_complex": None,
    "commission": None,
    "clean_description": "",
}


# Формулювання нульової комісії БЕЗ числа. Числові значення парсимо окремо:
# підрядок "0%" зустрічається всередині "50%"/"100%", тому текстове порівняння
# тут дало б катастрофічно хибний результат (50% → «без комісії»).
# Тільки НЕчислові фрази — будь-які числа обробляє парсер нижче.
NO_FEE_PHRASES = ["без комісі", "без комиси", "немає комісі", "нема комісі", "no commission"]
EMPTY_VALUES = {"null", "none", "-", "не вказано", "не вказана"}
AMOUNT_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*(%|грн|uah|₴)", re.IGNORECASE)


def classify(extraction: dict) -> tuple[str, str | None]:
    """Повертає (listing_type, commission)."""
    raw = (extraction.get("commission") or "").strip()
    if raw.lower() in EMPTY_VALUES:
        raw = ""
    commission = raw or None

    if extraction.get("probability_of_owner", 0) >= MIN_OWNER_PROB:
        return "owner", commission

    if commission:
        low = commission.lower()
        m = AMOUNT_RE.search(low)
        if m:  # є число (% або грн) — вирішує воно, а не підрядок
            amount = float(m.group(1).replace(",", "."))
            return ("agency_no_fee" if amount == 0 else "agency"), commission
        if any(p in low for p in NO_FEE_PHRASES):
            return "agency_no_fee", commission
    return "agency", commission


def level3_ai_analysis(ad: dict) -> dict:
    """Повертає структурований словник з оцінкою власника та даними оголошення."""

    system_prompt = """Ти — детектор посередників на ринку нерухомості України.
Твоє завдання: визначити, чи є автор оголошення реальним власником квартири, чи замаскованим рієлтором/агентством,
і витягнути структуровані дані з тексту оголошення.

КРИТЕРІЇ ВЛАСНИКА (підвищують score):
+ Побутові деталі: згадка сусідів, особистих спогадів, конкретних дрібниць ("балкон виходить на схід", "шафа залишається")
+ Неформальний, трохи "незграбний" текст без глянцевих штампів
+ Конкретна причина продажу ("переїжджаємо", "потрібні гроші на лікування")
+ Один об'єкт, текст написаний від першої особи

КРИТЕРІЇ РІЄЛТОРА (знижують score):
- Рекламні штампи: "ідеальний варіант", "бізнес-клас", "продумано до дрібниць", "розвинута інфраструктура"
- Надмірно структурований/шаблонний опис
- Фраза "є ще варіанти" або посилання на інші об'єкти
- Акцент на "чистоті угоди", юридичному супроводі
- Запрошення на огляд у конкретний офіс

Також витягни: ціну (число), валюту, кількість кімнат, район міста (якщо згаданий),
чи є меблі, площу в м², поверх, поверховість будинку, тип житла (apartment/house/room/studio),
назву ЖК (якщо є), КОМІСІЮ посередника як вона вказана в тексті ('0%', 'без комісії', '50%', або null
якщо не згадано), і перепиши опис без рекламних штампів та закликів звертатись (clean_description)."""

    # «невідомо» замість 0: підставляти 0 при невідомій кількості означало
    # підказувати моделі, що продавець має єдине оголошення (ознака власника).
    count = ad.get("seller_ads_count")
    ads_line = str(count) if count is not None else "невідомо"
    business = ad.get("is_business")
    business_line = {True: "бізнес-акаунт", False: "приватна особа"}.get(business, "невідомо")

    user_content = f"""Оголошення:
НАЗВА: {ad['title']}
ПРОДАВЕЦЬ: {ad['seller_name']}
ТИП АКАУНТУ ЗА ДАНИМИ OLX: {business_line}
АКТИВНИХ ОГОЛОШЕНЬ: {ads_line}
РЕЄСТРАЦІЯ: {ad['reg_date']}

ОПИС:
{ad['description'][:2000]}"""

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_content},
            ],
            temperature=0.2,
            response_format={"type": "json_schema", "json_schema": LISTING_JSON_SCHEMA},
        )
        data = json.loads(response.choices[0].message.content)
        data["probability_of_owner"] = int(data.get("probability_of_owner", 0))
        return data
    except json.JSONDecodeError as e:
        log.warning(f"AI повернув невалідний JSON: {e}")
        return dict(DEFAULT_EXTRACTION)
    except Exception as e:
        log.error(f"Помилка AI-аналізу: {e}")
        return {**DEFAULT_EXTRACTION, "reasoning": f"Помилка: {e}"}


# ─────────────────────────────────────────────
# SUPABASE
# ─────────────────────────────────────────────

def upload_photos_to_storage(session: requests.Session, photo_urls: list[str], ad_id: str) -> list[str]:
    """
    Завантажує фото у Supabase Storage і повертає публічні URL.
    Якщо Storage недоступний або завантаження впало — повертає сирі URL (фолбек).
    """
    if not photo_urls:
        return []
    if supabase is None:
        return photo_urls

    public_urls: list[str] = []
    for i, url in enumerate(photo_urls[:MAX_PHOTOS]):
        try:
            resp = session.get(url, timeout=20)
            resp.raise_for_status()
            path = f"olx/{ad_id}/{i}.jpg"
            supabase.storage.from_(SUPABASE_BUCKET).upload(
                path,
                resp.content,
                {"content-type": "image/jpeg", "upsert": "true"},
            )
            public_urls.append(supabase.storage.from_(SUPABASE_BUCKET).get_public_url(path))
        except Exception as e:
            log.warning(f"  ⚠️ Фото {i} не завантажилось у Storage ({e}), лишаю сирий URL")
            public_urls.append(url)
    return public_urls


def upsert_listing_to_supabase(ad: dict, extraction: dict, ad_id: str, photos: list[str], city: str | None = None) -> None:
    if supabase is None:
        return

    listing_type, commission = classify(extraction)

    row = {
        "source": "olx",
        "external_id": ad_id,
        "url": ad["url"],
        "title": ad["title"],
        "raw_description": ad["description"],
        "clean_description": extraction.get("clean_description", ""),
        "price": extraction.get("price"),
        "currency": extraction.get("currency"),
        "price_uah": to_uah(extraction.get("price"), extraction.get("currency")),
        "rooms": extraction.get("rooms"),
        "district": extraction.get("district"),
        "city": city or CITY,
        "has_furniture": extraction.get("has_furniture"),
        "area_sqm": extraction.get("area_sqm"),
        "floor": extraction.get("floor"),
        "total_floors": extraction.get("total_floors"),
        "property_type": extraction.get("property_type"),
        "residential_complex": extraction.get("residential_complex"),
        "listing_type": listing_type,
        "commission": commission,
        "commission_verified": False,
        "photos": photos,
        "probability_of_owner": extraction["probability_of_owner"],
        "ai_reasoning": extraction.get("reasoning", ""),
        "seller_name": ad["seller_name"],
    }
    try:
        supabase.table("listings").upsert(row, on_conflict="source,external_id").execute()
    except Exception as e:
        log.error(f"  ⚠️ Supabase upsert не вдався: {e}")


# ─────────────────────────────────────────────
# TELEGRAM
# ─────────────────────────────────────────────

def send_telegram(message: str) -> bool:
    success = False
    for chat_id in TELEGRAM_CHAT_IDS:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "HTML",
            "disable_web_page_preview": False,
        }
        try:
            resp = requests.post(url, json=payload, timeout=10)
            resp.raise_for_status()
            success = True
        except Exception as e:
            log.error(f"Telegram помилка для {chat_id}: {e}")
    return success


def format_telegram_message(ad: dict, probability: int, reasoning: str) -> str:
    verdict = "✅ <b>ВЛАСНИК</b>" if probability >= 80 else "⚠️ <b>ПІДОЗРА</b>"
    bar = "▓" * (probability // 10) + "░" * (10 - probability // 10)

    desc_preview = ad["description"][:400].replace("<", "&lt;").replace(">", "&gt;")
    if len(ad["description"]) > 400:
        desc_preview += "..."

    return (
        f"{verdict} — {probability}% власник\n"
        f"<code>[{bar}]</code>\n\n"
        f"📌 <b>{ad['title']}</b>\n"
        f"👤 Продавець: {ad['seller_name'] or 'невідомо'}\n"
        f"📋 Оголошень: {ad['seller_ads_count']}\n\n"
        f"🤖 <i>AI-висновок:</i>\n{reasoning}\n\n"
        f"📝 <i>Опис:</i>\n{desc_preview}\n\n"
        f"🔗 <a href='{ad['url']}'>Відкрити на OLX</a>"
    )


# ─────────────────────────────────────────────
# ГОЛОВНИЙ ЦИКЛ
# ─────────────────────────────────────────────

def process_ad(session: requests.Session, ad_stub: dict, seen_ads: set) -> str | None:
    """
    Обробляє одне оголошення через всі 4 рівні.
    Повертає ad_id якщо оголошення оброблено (незалежно від результату).
    """
    ad_url = ad_stub["url"]

    # Витягуємо унікальний ID з URL
    m = re.search(r"-ID(\w+)\.html", ad_url)
    ad_id = m.group(1) if m else ad_url

    if ad_id in seen_ads:
        return None  # Вже бачили

    log.info(f"Обробка: {ad_stub['title'][:60]}")
    stealth_sleep(*PAUSE_BETWEEN_REQUESTS)

    # Оновлюємо UA для кожного запиту (Рівень 4)
    session.headers.update({"User-Agent": random.choice(USER_AGENTS)})

    ad = fetch_ad_details(session, ad_url)
    if not ad:
        return ad_id

    # Рівень 1
    banned, reason = level1_technical_ban(ad)
    if banned:
        log.info(f"  ❌ L1 Бан: {reason}")
        return ad_id

    # Рівень 2
    banned, reason = level2_stop_words(ad)
    if banned:
        log.info(f"  ❌ L2 Стоп-слово: {reason}")
        return ad_id

    # Рівень 3
    log.info("  🤖 AI-аналіз...")
    extraction = level3_ai_analysis(ad)
    probability = extraction["probability_of_owner"]
    reasoning = extraction.get("reasoning", "")
    log.info(f"  📊 Ймовірність власника: {probability}%")

    # Фото → Supabase Storage (повертає публічні URL або сирі як фолбек)
    photos = upload_photos_to_storage(session, ad.get("photo_urls", []), ad_id)
    if photos:
        log.info(f"  🖼️ Фото: {len(photos)}")

    # Зберігаємо в Supabase все, що дійшло до AI-аналізу — поріг застосовується
    # на рівні фронтенду/запиту, а не на етапі збору даних.
    upsert_listing_to_supabase(ad, extraction, ad_id, photos, ad_stub.get("city"))

    if probability >= MIN_OWNER_PROB:
        message = format_telegram_message(ad, probability, reasoning)
        if send_telegram(message):
            log.info(f"  ✅ Надіслано в Telegram ({probability}%)")
        else:
            log.warning("  ⚠️ Telegram не відповів")
    else:
        log.info(f"  ⏭️ Пропущено (лише {probability}% < {MIN_OWNER_PROB}%)")

    return ad_id


def run_monitor():
    log.info("=" * 60)
    log.info("🏠 OLX Owner Detector — старт")
    log.info(f"Мінімальний поріг: {MIN_OWNER_PROB}% | Сторінок: {MAX_PAGES} | Міст: {len(MONITOR_SOURCES)}")
    log.info("=" * 60)

    seen_ads = load_seen_ads()
    log.info(f"Завантажено {len(seen_ads)} вже оброблених оголошень")

    cycle = 0
    while True:
        cycle += 1
        log.info(f"\n{'─'*50}\n🔄 Цикл #{cycle} — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        session = make_session()  # Нова сесія = нові cookies

        new_count = 0
        for src in MONITOR_SOURCES:
            log.info(f"\n🏙️ {src['city']} — сканування ({MAX_PAGES} стор.)")
            ad_stubs = fetch_listing_urls(session, src["url"])
            for stub in ad_stubs:
                stub["city"] = src["city"]
            stealth_sleep(2, 5)

            for stub in ad_stubs:
                ad_id = process_ad(session, stub, seen_ads)
                if ad_id:
                    seen_ads.add(ad_id)
                    new_count += 1

        save_seen_ads(seen_ads)
        log.info(f"💾 Оброблено {new_count} нових оголошень, всього в базі: {len(seen_ads)}")

        pause = random.uniform(*CYCLE_PAUSE)
        log.info(f"⏱️ Наступний цикл через {pause/60:.1f} хв...")
        time.sleep(pause)


if __name__ == "__main__":
    run_monitor()
    
    
