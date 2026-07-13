import asyncio
import re
import json
import os
from telethon import TelegramClient, events
from openai import OpenAI
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

client = OpenAI(api_key=OPENAI_API_KEY)
tg_client = TelegramClient('realtor_session', API_ID, API_HASH)

def ai_check(text):
    """Жорсткий аналіз тексту через AI для пошуку власника"""
    prompt = (
        f"Ти — експерт з нерухомості. Оціни ймовірність (0-100%), що це повідомлення від ВЛАСНИКА. "
        f"Знижуй бал за: професійний жаргон, списки з емодзі, фрази 'відео в приват', 'комісія 0%', 'ан', 'агенство нерухомості', 'агенція', 'код обєкту' "
        f"Текст: {text[:1000]}. "
        f"Формат відповіді: Ймовірність: X% [ПОСТ] Короткий опис об'єкта."
    )
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Ти шукаєш реальних господарів квартир, ігноруючи маклерів."},
                {"role": "user", "content": prompt}
            ]
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Помилка AI: {e}"

@tg_client.on(events.NewMessage(chats=MONITOR_CHANNELS))
async def handler(event):
    text = event.message.message
    if not text or len(text) < 40:
        return

    print(f"\n📩 Нове повідомлення в одному з чатів. Аналізую...")
    
    analysis = ai_check(text)
    
    # Витягуємо відсоток ймовірності
    prob_match = re.search(r'(\d+)%', analysis)
    prob = int(prob_match.group(1)) if prob_match else 0
    
    print(f"⚖️ Вердикт AI: {prob}%")

    if prob >= 75:
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
            
            # Отримуємо чистий опис від AI
            post_content = analysis.split('[ПОСТ]')[-1].strip()
            
            msg = (
                f"⚡️ <b>TG ВЛАСНИК ({prob}%)</b>\n\n"
                f"{post_content}\n\n"
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