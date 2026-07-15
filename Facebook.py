import time
import json
import os
import re
import random
from playwright.sync_api import sync_playwright
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

# --- НАЛАШТУВАННЯ ---
TOKEN = get_secret("TELEGRAM_BOT_TOKEN")
CHAT_ID = [
    cid for cid in [
        get_secret("TELEGRAM_CHAT_ID_1"),
        get_secret("TELEGRAM_CHAT_ID_2"),
    ] if cid
]
OPENAI_API_KEY = get_secret("OPENAI_API_KEY")

# Список груп для моніторингу (додайте свої посилання)
FB_GROUPS = [
    "https://www.facebook.com/groups/nomakler.lviv", 
    "https://www.facebook.com/groups/orenda.bez.maklera.lviv"
]

client = OpenAI(api_key=OPENAI_API_KEY)
DB_FILE = "seen_fb_posts.json"

def load_seen():
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, "r") as f: return set(json.load(f))
        except: return set()
    return set()

def save_seen(seen):
    with open(DB_FILE, "w") as f: json.dump(list(seen), f)

def ai_check_fb(text):
    prompt = f"""
    Оціни об'єкт (0-100% ймовірність власника). Текст: {text[:1200]}
    Шукай ознаки маклера: шаблонність, емодзі-списки, "відео в приват", "ключі на руках".
    Відповідай суворо:
    Ймовірність власника: X%
    Чому: (коротко)
    [ПОСТ]
    (текст)
    """
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini", 
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content
    except: return "Помилка AI"

def run_fb_hunter():
    seen_posts = load_seen()
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False) 
        context = browser.new_context(viewport={'width': 1280, 'height': 1024})
        page = context.new_page()

        for group_url in FB_GROUPS:
            try:
                print(f"\n🚀 Перевірка: {group_url}")
                page.goto(group_url, wait_until="networkidle")
                time.sleep(5) 

                # Прокрутка для завантаження
                page.mouse.wheel(0, 3000)
                time.sleep(3)

                posts = page.query_selector_all('div[role="article"]')
                
                for post in posts:
                    text = post.inner_text()
                    if len(text) < 100: continue

                    # --- ВИПРАВЛЕНИЙ МЕТОД ПОСИЛАННЯ ---
                    # Facebook зазвичай ховає посилання у часі публікації
                    post_link = group_url
                    links = post.query_selector_all('a[role="link"]')
                    for link in links:
                        href = link.get_attribute("href")
                        if href and ("/posts/" in href or "/permalink/" in href):
                            if "facebook.com" not in href:
                                post_link = "https://www.facebook.com" + href.split('?')[0]
                            else:
                                post_link = href.split('?')[0]
                            break

                    post_id = re.sub(r'\W+', '', text[:100])
                    if post_id in seen_posts: continue

                    print(f"🆕 Новий пост... {post_link}")
                    analysis = ai_check_fb(text)
                    
                    prob_match = re.search(r'власника:\s*(\d+)', analysis, re.I)
                    prob = int(prob_match.group(1)) if prob_match else 0
                    
                    if prob >= 70:
                        clean_content = analysis.split('[ПОСТ]')[-1].strip()
                        why = analysis.split('[ПОСТ]')[0].strip()
                        
                        # Формуємо повідомлення з чітким посиланням
                        msg = (
                            f"🏠 <b>ПЕРЕВІРЕНИЙ ВЛАСНИК ({prob}%)</b>\n\n"
                            f"{clean_content}\n\n"
                            f"🧐 <b>Аналіз:</b> {why}\n\n"
                            f"🔗 <a href='{post_link}'>ВІДКРИТИ ОГОЛОШЕННЯ</a>"
                        )
                        
                        requests.post(f"https://api.telegram.org/bot{TOKEN}/sendMessage", 
                                     json={"chat_id": CHAT_ID[0], "text": msg, "parse_mode": "HTML"})
                        print(f"✅ Надіслано!")

                    seen_posts.add(post_id)
                    save_seen(seen_posts)
                    
            except Exception as e:
                print(f"⚠️ Помилка: {e}")
                continue

        browser.close()

if __name__ == "__main__":
    while True:
        run_fb_hunter()
        time.sleep(900)