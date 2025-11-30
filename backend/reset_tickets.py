import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
import redis.asyncio as redis
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'telegram_ticket_db')
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')

async def reset_database():
    print(f"🔌 Connecting to MongoDB: {MONGO_URL}")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print(f"🔌 Connecting to Redis: {REDIS_URL}")
    redis_client = redis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)

    # Count before deletion
    ticket_count = await db.tickets.count_documents({})
    comment_count = await db.comments.count_documents({})
    
    print(f"\n⚠️  WARNING: This will PERMANENTLY DELETE:")
    print(f"   - {ticket_count} Tickets")
    print(f"   - {comment_count} Comments")
    print(f"   - All Redis Cache")
    
    confirm = input("\nAre you sure you want to proceed? (type 'yes' to confirm): ")
    
    if confirm.lower() == 'yes':
        print("\n🗑️  Deleting data...")
        
        # Delete tickets
        await db.tickets.delete_many({})
        print("✅ Tickets deleted.")
        
        # Delete comments
        await db.comments.delete_many({})
        print("✅ Comments deleted.")
        
        # Flush Redis
        try:
            await redis_client.flushdb()
            print("✅ Redis cache cleared.")
        except Exception as e:
            print(f"❌ Failed to clear Redis: {e}")
            
        print("\n✨ Database reset complete!")
    else:
        print("\n❌ Operation cancelled.")

if __name__ == "__main__":
    try:
        asyncio.run(reset_database())
    except KeyboardInterrupt:
        print("\n❌ Operation cancelled.")
    except Exception as e:
        print(f"\n❌ Error: {e}")
