import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
DATABASE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.db")
NCM_API = os.getenv("NCM_API", "http://localhost:3000")
