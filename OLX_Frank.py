#!/usr/bin/env python3
"""
OLX Real Estate Monitor — Frankivskyi District + Google Sheets
Моніторинг оренди з відправкою в Telegram та записом у Google Таблицю.
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

try:
    import config
except ImportError:
    config = None


def get_secret(name: str, default: str = "") -> str:
    if config is not None and hasattr(config, name):
        return getattr(config, name)
    return os.getenv(name, default)

# Імпорти для Google Sheets
import gspread
from oauth2client.service_account import ServiceAccountCredentials

# ─────────────────────────────────────────────
# КОНФІГУРАЦІЯ
# ─────────────────────────────────────────────
TELEGRAM_BOT_TOKEN = get_secret("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_IDS = [
    cid for cid in [
        get_secret("TELEGRAM_CHAT_ID_1"),
        get_secret("TELEGRAM_CHAT_ID_2"),
    ] if cid
]
OPENAI_API_KEY = get_secret("OPENAI_API_KEY")

# Налаштування Google Sheets
GSHEET_NAME = get_secret("GSHEET_NAME", "Львів Оренда")
CREDENTIALS_FILE = get_secret("GOOGLE_CREDENTIALS_FILE", "credentials.json")

# Посилання на OLX з вибраним Франківським районом
MONITOR_URLS = [
    "https://www.olx.ua/uk/nedvizhimost/kvartiry/dolgosrochnaya-arenda-kvartir/lvov/?search%5Bdistrict_id%5D=135&currency=UAH",
    "https://www.olx.ua/uk/nedvizhimost/kvartiry/dolgosrochnaya-arenda-kvartir/lvov/?search%5Bdistrict_id%5D=135&currency=USD"
]
SEEN_ADS_FILE = Path("seen_ads_frankivskyi.json")

# Пагінація та інтервали
MAX_PAGES = 3                    
PAUSE_BETWEEN_PAGES = (5, 12)   
PAUSE_BETWEEN_REQUESTS = (10, 20)
CYCLE_PAUSE = (300, 480)   

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
]

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

openai_client = OpenAI(api_key=OPENAI_API_KEY)

# Ініціалізація Google Sheets
def get_gsheet_client():
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    try:
        creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_FILE, scope)
        return gspread.authorize(creds)
    except Exception as e:
        log.error(f"Не вдалося підключити Google Sheets (перевірте credentials.json): {e}")
        return None

gsheet_client = get_gsheet_client()

# ─────────────────────────────────────────────
# БАЗОВІ ФУНКЦІЇ (Завантаження, Парсинг)
# ─────────────────────────────────────────────
def load_seen_ads() -> set:
    if SEEN_ADS_FILE.exists():
        try: return set(json.loads(SEEN_ADS_FILE.read_text(encoding="utf-8")))
        except: pass
    return set()

def save_seen_ads(seen: set) -> None:
    SEEN_ADS_FILE.write_text(json.dumps(list(seen), ensure_ascii=False, indent=2), encoding="utf-8")

def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": random.choice(USER_AGENTS), "Referer": "https://www.olx.ua/"})
    return session

def safe_get(session: requests.Session, url: str) -> requests.Response | None:
    for attempt in range(3):
        try:
            resp = session.get(url, timeout=20)
            resp.raise_for_status()
            return resp
        except: time.sleep(random.uniform(10, 20))
    return None

def fetch_listing_urls(session: requests.Session, base_url: str) -> list[dict]:
    all_ads = []
    for page_num in range(1, MAX_PAGES + 1):
        url = f"{base_url}&page={page_num}" if page_num > 1 else base_url
        session.headers.update({"User-Agent": random.choice(USER_AGENTS)})
        resp = safe_get(session, url)
        if not resp: break
        
        soup = BeautifulSoup(resp.text, "html.parser")
        for card in soup.select('[data-cy="l-card"]'):
            a_tag = card.select_one("a[href]")
            if not a_tag: continue
            href = "https://www.olx.ua" + a_tag["href"] if not a_tag["href"].startswith("http") else a_tag["href"]
            title = card.select_one("h4, h3, [data-testid='ad-title']").get_text(strip=True)
            all_ads.append({"url": href, "title": title})
            
        time.sleep(random.uniform(*PAUSE_BETWEEN_PAGES))
    return all_ads

def fetch_ad_details(session: requests.Session, ad_url: str) -> dict | None:
    resp = safe_get(session, ad_url)
    if not resp: return None
    soup = BeautifulSoup(resp.text, "html.parser")
    title = soup.select_one("h1").get_text(strip=True) if soup.select_one("h1") else "Без назви"
    desc_tag = soup.select_one('[data-cy="ad_description"]') or soup.select_one(".descriptioncontent")
    seller_tag = soup.select_one('[data-testid="user-profile-link"]') or soup.select_one(".userdetails strong")
    return {
        "url": ad_url, "title": title,
        "description": desc_tag.get_text(" ", strip=True) if desc_tag else "",
        "seller_name": seller_tag.get_text(strip=True) if seller_tag else "Не вказано"
    }

# ─────────────────────────────────────────────
# AI ТА ВІДПРАВКА
# ─────────────────────────────────────────────
def level_ai_analysis(ad: dict) -> dict:
    prompt = """Ти помічник з нерухомості. Локація: Львів (Франківський район).
ПРІОРИТЕТ: Вулиця Вітовського, Княгині Ольги, Сахарова, Бой-Желенського, Коперника, Чупринки тощо.
Відповідай ТІЛЬКИ у форматі JSON:
{"is_priority": true/false, "location": "Вулиця", "summary": "Коротко суть (до 20 слів)"}"""
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": prompt}, {"role": "user", "content": f"ОПИС:\n{ad['description'][:2000]}"}],
            temperature=0.1, max_tokens=200
        )
        raw = re.sub(r"```json\s*|\s*```", "", response.choices[0].message.content.strip()).strip()
        return json.loads(raw)
    except Exception as e:
        return {"is_priority": False, "location": "Помилка", "summary": "Помилка аналізу"}

def send_telegram(ad: dict, ai_data: dict):
    header = "🔥 <b>ПРІОРИТЕТ</b> 🔥" if ai_data.get("is_priority") else "🏠 <b>НОВЕ</b>"
    msg = f"{header}\n\n📌 <b>{ad['title']}</b>\n📍 Вулиця: {ai_data.get('location')}\n👤 Автор: {ad['seller_name']}\n\n🤖 <i>AI:</i> {ai_data.get('summary')}\n\n🔗 <a href='{ad['url']}'>Відкрити на OLX</a>"
    for cid in TELEGRAM_CHAT_IDS:
        try: requests.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage", json={"chat_id": cid, "text": msg, "parse_mode": "HTML"}, timeout=10)
        except: pass

def append_to_gsheet(ad: dict, ai_data: dict):
    if not gsheet_client: return
    try:
        sheet = gsheet_client.open(GSHEET_NAME).sheet1
        row = [
            datetime.now().strftime('%Y-%m-%d %H:%M'),  # Дата
            "🆕 Новий",                                  # Статус (ти будеш його міняти руками)
            "🔥 ТАК" if ai_data.get("is_priority") else "Ні", # Пріоритет
            ai_data.get("location", ""),                # Вулиця
            ad["title"],                                # Назва
            ai_data.get("summary", ""),                 # Резюме AI
            ad["url"],                                  # Посилання
            ""                                          # Коментар
        ]
        sheet.append_row(row)
        log.info("  📊 Записано в Google Таблицю")
    except Exception as e:
        log.error(f"  ⚠️ Помилка запису в таблицю: {e}")

# ─────────────────────────────────────────────
# ГОЛОВНИЙ ЦИКЛ
# ─────────────────────────────────────────────
def process_ad(session: requests.Session, ad_stub: dict, seen_ads: set) -> str | None:
    ad_id = re.search(r"-ID(\w+)\.html", ad_stub["url"]).group(1) if re.search(r"-ID(\w+)\.html", ad_stub["url"]) else ad_stub["url"]
    if ad_id in seen_ads: return None  

    log.info(f"Обробка: {ad_stub['title'][:60]}")
    time.sleep(random.uniform(*PAUSE_BETWEEN_REQUESTS))
    session.headers.update({"User-Agent": random.choice(USER_AGENTS)})

    ad = fetch_ad_details(session, ad_stub["url"])
    if not ad: return ad_id

    ai_data = level_ai_analysis(ad)
    send_telegram(ad, ai_data)
    append_to_gsheet(ad, ai_data) # <--- Додано виклик запису в таблицю

    return ad_id

def run_monitor():
    log.info("=" * 60)
    log.info("🏠 OLX Monitor — Франківський район + Google Sheets")
    log.info("=" * 60)
    seen_ads = load_seen_ads()
    while True:
        session = make_session()  
        for base_url in MONITOR_URLS:
            for stub in fetch_listing_urls(session, base_url):
                ad_id = process_ad(session, stub, seen_ads)
                if ad_id: seen_ads.add(ad_id)
        save_seen_ads(seen_ads)
        log.info("Очікування наступного циклу...")
        time.sleep(random.uniform(*CYCLE_PAUSE))

if __name__ == "__main__":
    run_monitor()