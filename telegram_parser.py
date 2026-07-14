import asyncio
import json
import os
from telethon import TelegramClient, events
from openai import OpenAI
from supabase import create_client
import requests

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

# 5. Список каналів/чатів для моніторингу (ви маєте бути в них підписані)
MONITOR_CHANNELS = [
    'orendakvarturlviv', 
    'lviv_neruhomist',
    'nerukhomist_prodazh_lviv',
    'orendakvartyr_ua',
    'neruhomist_lviv_ua',
    'Orenda_Lviv_U',
    'lvivska_neruhomist',
    'direct_rent',
    'lvivnerucho',
    'prodaglvivkvarturu'
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
            "probability_of_owner": {"type": "integer", "description": "0-100"},
            "reasoning": {"type": "string", "description": "Стисле пояснення до 150 слів"},
            "price": {"type": ["number", "null"]},
            "currency": {"type": ["string", "null"], "enum": ["UAH", "USD", "EUR", None]},
            "rooms": {"type": ["integer", "null"]},
            "district": {"type": ["string", "null"], "description": "Район міста, якщо згадується в тексті"},
            "has_furniture": {"type": ["boolean", "null"]},
            "clean_description": {
                "type": "string",
                "description": "Опис переписаний без рекламних штампів, посилань на агентство та закликів звертатись",
            },
        },
        "required": [
            "probability_of_owner", "reasoning", "price", "currency",
            "rooms", "district", "has_furniture", "clean_description",
        ],
        "additionalProperties": False,
    },
}

DEFAULT_EXTRACTION = {
    "probability_of_owner": 0,
    "reasoning": "Не вдалось отримати оцінку AI",
    "price": None,
    "currency": None,
    "rooms": None,
    "district": None,
    "has_furniture": None,
    "clean_description": "",
}


def ai_check(text: str) -> dict:
    """Аналізує пост через AI: ймовірність власника + структуровані дані оголошення."""
    system_prompt = (
        "Ти — детектор посередників на ринку нерухомості України. Визнач, чи цей пост "
        "написаний реальним власником квартири, чи замаскованим рієлтором/агентством. "
        "Знижуй бал за: професійний жаргон, списки з емодзі, фрази 'відео в приват', "
        "'комісія 0%', 'ан', 'агенство нерухомості', 'агенція', 'код обєкту'. "
        "Також витягни ціну, валюту, кількість кімнат, район міста (якщо згаданий), "
        "чи є меблі, і перепиши опис без рекламних штампів та закликів звертатись (clean_description)."
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
        return data
    except Exception as e:
        return {**DEFAULT_EXTRACTION, "reasoning": f"Помилка AI: {e}"}


def upsert_listing_to_supabase(extraction: dict, external_id: str, url: str, raw_text: str) -> None:
    if supabase is None:
        return

    row = {
        "source": "telegram",
        "external_id": external_id,
        "url": url,
        "title": raw_text[:120],
        "raw_description": raw_text,
        "clean_description": extraction.get("clean_description", ""),
        "price": extraction.get("price"),
        "currency": extraction.get("currency"),
        "rooms": extraction.get("rooms"),
        "district": extraction.get("district"),
        "city": CITY,
        "has_furniture": extraction.get("has_furniture"),
        "probability_of_owner": extraction["probability_of_owner"],
        "ai_reasoning": extraction.get("reasoning", ""),
    }
    try:
        supabase.table("listings").upsert(row, on_conflict="source,external_id").execute()
    except Exception as e:
        print(f"⚠️ Supabase upsert не вдався: {e}")

@tg_client.on(events.NewMessage(chats=MONITOR_CHANNELS))
async def handler(event):
    text = event.message.message
    if not text or len(text) < 40:
        return

    print(f"\n📩 Нове повідомлення в одному з чатів. Аналізую...")

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

        # Зберігаємо в Supabase все, що дійшло до AI-аналізу — поріг застосовується
        # на рівні фронтенду/запиту, а не на етапі збору даних.
        upsert_listing_to_supabase(extraction, external_id, link, text)

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
    print(f"📡 Моніторинг чатів: {', '.join(MONITOR_CHANNELS)}")
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