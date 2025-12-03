import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
import logging

async def list_tickets():
    client = AsyncIOMotorClient(settings.MONGO_URL)
    db = client[settings.DB_NAME]
    
    tickets = await db.tickets.find({}).to_list(100)
    print(f"Total Tickets in DB: {len(tickets)}")
    for t in tickets:
        print(f"- {t.get('ticket_number')} | Status: {t.get('status')} | Agent: {t.get('assigned_agent_name')} | Created: {t.get('created_at')}")

if __name__ == "__main__":
    asyncio.run(list_tickets())
