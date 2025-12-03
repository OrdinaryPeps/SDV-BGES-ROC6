import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = "telegram_ticket_db"

async def check_date_type():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    ticket = await db.tickets.find_one({})
    if ticket:
        created_at = ticket.get('created_at')
        print(f"Sample Ticket ID: {ticket.get('_id')}")
        print(f"created_at value: {created_at}")
        print(f"created_at type: {type(created_at)}")
    else:
        print("No tickets found.")

if __name__ == "__main__":
    asyncio.run(check_date_type())
