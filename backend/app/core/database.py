from motor.motor_asyncio import AsyncIOMotorClient
import redis.asyncio as redis
from .config import settings

# MongoDB
client = AsyncIOMotorClient(settings.MONGO_URL)
db = client[settings.DB_NAME]

# Redis
redis_client = redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)

async def get_db():
    return db

async def get_redis():
    return redis_client
