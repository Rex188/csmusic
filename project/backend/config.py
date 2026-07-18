import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the backend/ directory explicitly,
# since load_dotenv() by default only searches CWD and parent dirs
dotenv_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path)

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
DATABASE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.db")
NCM_API = os.getenv("NCM_API", "http://localhost:3000")

# LLM config for playlist analysis (OpenAI-compatible API)
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_API_URL = os.getenv("LLM_API_URL", "https://api.deepseek.com/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "deepseek-chat")

# SMTP config for email verification (optional — fallback to console logging)
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@music-self.app")
APP_URL = os.getenv("APP_URL", "https://music-self.onrender.com")
