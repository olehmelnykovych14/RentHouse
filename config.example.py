import os

# Local config file for secrets and tokens.
# Copy this file to config.py and fill values there.

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID_1 = os.getenv("TELEGRAM_CHAT_ID_1", "")
TELEGRAM_CHAT_ID_2 = os.getenv("TELEGRAM_CHAT_ID_2", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Telegram client settings (for Telethon-based scripts)
TG_API_ID = os.getenv("TG_API_ID", "")
TG_API_HASH = os.getenv("TG_API_HASH", "")

# Google credentials file name (ignored by git)
GOOGLE_CREDENTIALS_FILE = os.getenv("GOOGLE_CREDENTIALS_FILE", "credentials.json")
GSHEET_NAME = os.getenv("GSHEET_NAME", "Львів Оренда")
