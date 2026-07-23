import asyncio
import json
import os
import re
from telethon import TelegramClient, events
from openai import OpenAI
from supabase import create_client
import requests

import owner_detection

try:
    import config
except ImportError:
    config = None


def get_secret(name: str, default: str = "") -> str:
    if config is not None and hasattr(config, name):
        return getattr(config, name)
    return os.getenv(name, default)

# --- [НАЛАШТУВАННЯ] ---

# 1. Дані з my.telegram.org
_api_id = get_secret("TG_API_ID", "")
API_ID = int(_api_id) if _api_id else None
API_HASH = get_secret("TG_API_HASH")

# 2. Налаштування Telegram-бота (через BotFather)
TOKEN = get_secret("TELEGRAM_BOT_TOKEN")

# 3. Список ID користувачів, які отримуватимуть сповіщення
CHAT_IDS = [
    cid for cid in [
        get_secret("TELEGRAM_CHAT_ID_1"),
        get_secret("TELEGRAM_CHAT_ID_2"),
    ] if cid
]

# 4. Ключ OpenAI
OPENAI_API_KEY = get_secret("OPENAI_API_KEY")

# 4b. Supabase (той самий проєкт, що й у olx_monitor)
SUPABASE_URL = get_secret("SUPABASE_URL")
SUPABASE_SERVICE_KEY = get_secret("SUPABASE_SERVICE_KEY")
CITY = "Львів"
SUPABASE_BUCKET = "listing-photos"   # публічний bucket у Supabase Storage
MAX_PHOTOS = 15

FX_TO_UAH = {"UAH": 1, "USD": 41, "EUR": 44}


def to_uah(price, currency):
    if price is None:
        return None
    rate = FX_TO_UAH.get((currency or "UAH").upper())
    return round(price * rate) if rate else None

# 5. Сід-список каналів (fallback). Основне джерело — таблиця channel_sources у Supabase;
#    цей список використовується лише якщо БД недоступна або порожня.
# Тільки орендні канали. Канали продажу сюди не додаємо: post_type відсіює
# продаж і на рівні поста, але гнати тисячі оголошень про продаж через AI —
# це витрачені гроші й ризик, що щось прослизне.
# Свідомо ВИКЛЮЧЕНІ (продаж): nerukhomist_prodazh_lviv, prodaglvivkvarturu.
SEED_CHANNELS = [
    'orendakvarturlviv',
    'lviv_neruhomist',
    'orendakvartyr_ua',
    'neruhomist_lviv_ua',
    'Orenda_Lviv_U',
    'lvivska_neruhomist',
    'direct_rent',
    'lvivnerucho',
]

# --- [ІНІЦІАЛІЗАЦІЯ] ---

MIN_OWNER_PROB = 75

client = OpenAI(api_key=OPENAI_API_KEY)
tg_client = TelegramClient('realtor_session', API_ID, API_HASH)
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY) if SUPABASE_URL and SUPABASE_SERVICE_KEY else None

LISTING_JSON_SCHEMA = {
    "name": "listing_extraction",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            **owner_detection.POST_TYPE_PROPERTY,
            **owner_detection.SIGNAL_PROPERTIES,
            "probability_of_owner": {"type": "integer", "description": "0-100"},
            "reasoning": {"type": "string", "description": "Стисле пояснення до 150 слів"},
            "price": {"type": ["number", "null"]},
            "currency": {"type": ["string", "null"], "enum": ["UAH", "USD", "EUR", None]},
            "rooms": {"type": ["integer", "null"]},
            "city": {
                "type": ["string", "null"],
                "description": "Місто у називному відмінку (Київ, Львів, Одеса…), якщо згадане або зрозуміле з тексту",
            },
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
                "description": "Комісія посередника як у тексті: '0%', 'без комісії', '50%'. null — не згадано",
            },
            "clean_description": {
                "type": "string",
                "description": "Опис переписаний без рекламних штампів, посилань на агентство та закликів звертатись",
            },
        },
        "required": [
            "post_type", "owner_signals", "realtor_signals",
            "probability_of_owner", "reasoning", "price", "currency",
            "rooms", "city", "district", "has_furniture", "area_sqm", "floor",
            "total_floors", "property_type", "residential_complex", "commission", "clean_description",
        ],
        "additionalProperties": False,
    },
}

DEFAULT_EXTRACTION = {
    "post_type": "other",
    "owner_signals": [],
    "realtor_signals": [],
    "probability_of_owner": 0,
    "reasoning": "Не вдалось отримати оцінку AI",
    "price": None,
    "currency": None,
    "rooms": None,
    "city": None,
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

MIN_OWNER_PROB = 70
# Числову комісію парсимо, а не шукаємо підрядком: "0%" міститься в "50%"/"100%".
# Тільки НЕчислові фрази — числа (% чи грн) обробляє парсер нижче.
NO_FEE_PHRASES = ["без комісі", "без комиси", "немає комісі", "нема комісі", "no commission"]
EMPTY_VALUES = {"null", "none", "-", "не вказано", "не вказана"}
AMOUNT_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*(%|грн|uah|₴)", re.IGNORECASE)


def classify(extraction: dict) -> tuple[str, str | None]:
    """Повертає (listing_type, commission) за оцінкою AI + комісією з тексту."""
    raw = (extraction.get("commission") or "").strip()
    if raw.lower() in EMPTY_VALUES:
        raw = ""
    commission = raw or None

    if extraction.get("probability_of_owner", 0) >= MIN_OWNER_PROB:
        return "owner", commission

    if commission:
        low = commission.lower()
        m = AMOUNT_RE.search(low)
        if m:
            amount = float(m.group(1).replace(",", "."))
            return ("agency_no_fee" if amount == 0 else "agency"), commission
        if any(p in low for p in NO_FEE_PHRASES):
            return "agency_no_fee", commission
    return "agency", commission


# --- [ДЖЕРЕЛА КАНАЛІВ] ---

# @згадки інших каналів у тексті (напр. "більше на @orenda_lviv")
_MENTION_RE = re.compile(r"@([A-Za-z][A-Za-z0-9_]{3,31})")


def seed_channels_to_db() -> None:
    """Одноразово заливає сід-канали в channel_sources як active (idempotent)."""
    if supabase is None:
        return
    rows = [
        {"platform": "telegram", "identifier": ch, "status": "active", "source": "seed"}
        for ch in SEED_CHANNELS
    ]
    try:
        supabase.table("channel_sources").upsert(
            rows, on_conflict="platform,identifier", ignore_duplicates=True
        ).execute()
    except Exception as e:
        print(f"⚠️ Не вдалось залити сід-канали: {e}")


# Місто на канал: заповнюється з channel_sources.city при старті.
CHANNEL_CITY: dict[str, str] = {}


def load_active_channels() -> list[str]:
    """
    Активні telegram-канали з БД + мапа «канал → місто» (для мульти-міста).
    Fallback — сід-список, якщо БД порожня/недоступна.
    """
    if supabase is None:
        return SEED_CHANNELS
    try:
        resp = (
            supabase.table("channel_sources")
            .select("identifier, city")
            .eq("platform", "telegram")
            .eq("status", "active")
            .execute()
        )
        rows = resp.data or []
        for r in rows:
            if r.get("city"):
                CHANNEL_CITY[r["identifier"].lstrip("@").lower()] = r["city"]
        channels = [r["identifier"] for r in rows]
        return channels or SEED_CHANNELS
    except Exception as e:
        print(f"⚠️ Не вдалось завантажити канали з БД ({e}), використовую сід-список")
        return SEED_CHANNELS


def discover_channels_from_text(text: str) -> None:
    """Витягує @згадки каналів і додає їх у чергу (status='pending') на модерацію."""
    if supabase is None or not text:
        return
    mentions = {m.lower() for m in _MENTION_RE.findall(text)}
    if not mentions:
        return
    rows = [
        {"platform": "telegram", "identifier": m, "status": "pending", "source": "mention"}
        for m in mentions
    ]
    try:
        supabase.table("channel_sources").upsert(
            rows, on_conflict="platform,identifier", ignore_duplicates=True
        ).execute()
    except Exception as e:
        print(f"⚠️ Discovery: не вдалось додати кандидатів: {e}")


def ai_check(text: str) -> dict:
    """Аналізує пост через AI: ймовірність власника + структуровані дані оголошення."""
    system_prompt = owner_detection.build_system_prompt(
        "Також витягни МІСТО (називний відмінок: Київ, Львів, Одеса — якщо згадане чи "
        "зрозуміле з контексту), ціну, валюту, кількість кімнат, район міста (якщо згаданий), "
        "чи є меблі, площу в м², поверх, поверховість будинку, тип житла "
        "(apartment/house/room/studio), назву ЖК (якщо є), КОМІСІЮ посередника як у тексті "
        "('0%', 'без комісії', '50%', або null якщо не згадано), і перепиши опис без "
        "рекламних штампів та закликів звертатись (clean_description)."
    )
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Текст поста:\n{text[:2000]}"},
            ],
            temperature=0.2,
            response_format={"type": "json_schema", "json_schema": LISTING_JSON_SCHEMA},
        )
        data = json.loads(response.choices[0].message.content)
        data["probability_of_owner"] = int(data.get("probability_of_owner", 0))
        # Докази мають пріоритет над числом, якщо вони суперечать одне одному.
        return owner_detection.calibrate(data)
    except Exception as e:
        return {**DEFAULT_EXTRACTION, "reasoning": f"Помилка AI: {e}"}


def upload_photo_bytes_to_storage(data: bytes, external_id: str, idx: int) -> str | None:
    """Вантажить байти фото у Supabase Storage, повертає публічний URL (або None)."""
    if supabase is None or not data:
        return None
    try:
        path = f"telegram/{external_id}/{idx}.jpg"
        supabase.storage.from_(SUPABASE_BUCKET).upload(
            path,
            data,
            {"content-type": "image/jpeg", "upsert": "true"},
        )
        return supabase.storage.from_(SUPABASE_BUCKET).get_public_url(path)
    except Exception as e:
        print(f"⚠️ Фото {idx} не завантажилось у Storage: {e}")
        return None


async def collect_photos(event, messages, external_id: str) -> list[str]:
    """
    Завантажує фото з повідомлення (або альбому) у Storage.
    messages — список повідомлень альбому, або [event.message] для одиночного.
    """
    public_urls: list[str] = []
    idx = 0
    for msg in messages:
        if not getattr(msg, "photo", None) or idx >= MAX_PHOTOS:
            continue
        try:
            data = await event.client.download_media(msg, file=bytes)
            url = upload_photo_bytes_to_storage(data, external_id, idx)
            if url:
                public_urls.append(url)
            idx += 1
        except Exception as e:
            print(f"⚠️ Не вдалось завантажити медіа: {e}")
    return public_urls


# Місячна оренда в гривнях. Нижня межа відсіює «ціна за добу» й помилки парсингу,
# верхня — оголошення про ПРОДАЖ, які прослизнули повз post_type (мільйони гривень).
RENT_UAH_MIN = 1_500
RENT_UAH_MAX = 300_000


def reject_reason(extraction: dict) -> str | None:
    """
    Чому пост НЕ можна класти в каталог. None — можна.

    Канали оренди містять не лише пропозиції: продаж, запити «шукаю житло»,
    рекламу ботів. Без цієї перевірки все це потрапляло в каталог як оренда.
    """
    post_type = extraction.get("post_type", "other")
    if post_type != "rent_offer":
        return f"post_type={post_type}"

    price_uah = to_uah(extraction.get("price"), extraction.get("currency"))
    if price_uah is None:
        return "немає ціни"
    if not (RENT_UAH_MIN <= price_uah <= RENT_UAH_MAX):
        return f"ціна поза межами оренди: {price_uah} грн"
    return None


def upsert_listing_to_supabase(extraction: dict, external_id: str, url: str, raw_text: str, photos: list[str], city: str | None = None) -> None:
    if supabase is None:
        return

    reason = reject_reason(extraction)
    if reason:
        print(f"⏭️ Пропущено ({reason})")
        return

    listing_type, commission_val = classify(extraction)

    row = {
        "source": "telegram",
        "external_id": external_id,
        "url": url,
        "title": raw_text[:120],
        "raw_description": raw_text,
        "clean_description": extraction.get("clean_description", ""),
        "price": extraction.get("price"),
        "currency": extraction.get("currency"),
        "price_uah": to_uah(extraction.get("price"), extraction.get("currency")),
        "rooms": extraction.get("rooms"),
        "district": extraction.get("district"),
        # Пріоритет: місто з тексту оголошення → місто каналу → запасне.
        "city": extraction.get("city") or city or CITY,
        "has_furniture": extraction.get("has_furniture"),
        "area_sqm": extraction.get("area_sqm"),
        "floor": extraction.get("floor"),
        "total_floors": extraction.get("total_floors"),
        "property_type": extraction.get("property_type"),
        "residential_complex": extraction.get("residential_complex"),
        "listing_type": listing_type,
        "commission": commission_val,
        "commission_verified": False,
        "photos": photos,
        "probability_of_owner": extraction["probability_of_owner"],
        "ai_reasoning": extraction.get("reasoning", ""),
    }
    try:
        supabase.table("listings").upsert(row, on_conflict="source,external_id").execute()
    except Exception as e:
        print(f"⚠️ Supabase upsert не вдався: {e}")

async def handler(event):
    text = event.message.message
    if not text or len(text) < 40:
        return

    print(f"\n📩 Нове повідомлення в одному з чатів. Аналізую...")

    # Discovery: підхоплюємо @згадки інших каналів у чергу на модерацію
    discover_channels_from_text(text)

    extraction = ai_check(text)
    prob = extraction["probability_of_owner"]

    print(f"⚖️ Вердикт AI: {prob}%")

    try:
        chat = await event.get_chat()
        msg_id = event.message.id

        # Спроба створити пряме посилання на пост
        if chat.username:
            link = f"https://t.me/{chat.username}/{msg_id}"
        else:
            # Для приватних груп робимо посилання через ID чату
            chat_id_str = str(event.chat_id).replace("-100", "")
            link = f"https://t.me/c/{chat_id_str}/{msg_id}"

        external_id = f"{event.chat_id}_{msg_id}"

        # Фото → Supabase Storage. Наразі беремо фото з повідомлення-підпису;
        # повна підтримка альбомів (events.Album) — окремий крок.
        photos = await collect_photos(event, [event.message], external_id)

        # Зберігаємо в Supabase все, що дійшло до AI-аналізу — поріг застосовується
        # на рівні фронтенду/запиту, а не на етапі збору даних.
        # Місто визначаємо за каналом (channel_sources.city), інакше — запасне CITY.
        city = CHANNEL_CITY.get((getattr(chat, "username", "") or "").lower())
        upsert_listing_to_supabase(extraction, external_id, link, text, photos, city)

        if prob >= MIN_OWNER_PROB:
            msg = (
                f"⚡️ <b>TG ВЛАСНИК ({prob}%)</b>\n\n"
                f"{extraction.get('clean_description', '')}\n\n"
                f"🧐 <b>Оригінал:</b>\n<i>{text[:400]}...</i>\n\n"
                f"🔗 <a href='{link}'>ВІДКРИТИ ПОВІДОМЛЕННЯ</a>"
            )

            # Відправка всім отримувачам зі списку
            for cid in CHAT_IDS:
                requests.post(
                    f"https://api.telegram.org/bot{TOKEN}/sendMessage",
                    json={
                        "chat_id": cid,
                        "text": msg,
                        "parse_mode": "HTML",
                        "disable_web_page_preview": False
                    }
                )

            print(f"✅ Надіслано двом користувачам! (Ймовірність: {prob}%)")

    except Exception as e:
        print(f"⚠️ Помилка при обробці повідомлення: {e}")

async def main():
    print("-" * 30)
    print("🚀 Telegram Hunter v3.0 запущен!")

    # Джерела каналів — з БД (з fallback на сід-список)
    seed_channels_to_db()
    channels = load_active_channels()
    tg_client.add_event_handler(handler, events.NewMessage(chats=channels))

    print(f"📡 Моніторинг {len(channels)} каналів: {', '.join(channels)}")
    print(f"👥 Отримувачі: {', '.join(CHAT_IDS)}")
    print("-" * 30)

    await tg_client.start()
    print("🔓 Авторизація успішна. Чекаю на повідомлення...")
    await tg_client.run_until_disconnected()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Бот зупинений користувачем.")