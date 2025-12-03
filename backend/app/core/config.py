from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional
import os

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'),
        env_ignore_empty=True,
        extra="ignore"
    )

    API_V1_STR: str = "/api"
    PROJECT_NAME: str = "BotSDV Backend"
    
    # Database
    MONGO_URL: str = "mongodb://localhost:27017"
    DB_NAME: str = "telegram_ticket_db"
    REDIS_URL: str = "redis://localhost:6379"
    
    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8004"]
    
    # Bot
    BOT_TOKEN: Optional[str] = None
    GROUP_CHAT_ID: Optional[str] = None

settings = Settings()
