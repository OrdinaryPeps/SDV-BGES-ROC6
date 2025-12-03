import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.models.ticket import TicketUpdate
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def debug_claim():
    client = AsyncIOMotorClient(settings.MONGO_URL)
    db = client[settings.DB_NAME]
    
    # 1. Find an open ticket
    ticket = await db.tickets.find_one({"status": "open"})
    if not ticket:
        print("No open tickets found. Creating one...")
        from app.models.ticket import Ticket
        new_ticket = Ticket(
            ticket_number="TEST-CLAIM-001",
            user_telegram_id="123456789",
            user_telegram_name="Test User",
            category="TEST",
            description="Test Ticket for Claim Debug"
        )
        ticket_dict = new_ticket.model_dump()
        ticket_dict['created_at'] = ticket_dict['created_at'].isoformat()
        await db.tickets.insert_one(ticket_dict)
        ticket = await db.tickets.find_one({"ticket_number": "TEST-CLAIM-001"})

    print(f"Found/Created open ticket: {ticket['ticket_number']} (ID: {ticket['id']})")
    
    # 2. Find an agent
    agent = await db.users.find_one({"role": "agent"})
    if not agent:
        # Try finding admin if no agent
        agent = await db.users.find_one({"role": "admin"})
        
    if not agent:
        print("No agent/admin found.")
        return
        
    print(f"Using agent: {agent['username']} (ID: {agent['id']})")
    
    # 3. Simulate Claim (Update)
    update_data = {
        "assigned_agent": agent['id'],
        "assigned_agent_name": agent.get('full_name', agent['username']),
        "status": "in_progress",
        "updated_at": datetime.now()
    }
    
    print(f"Updating ticket with: {update_data}")
    
    await db.tickets.update_one(
        {"id": ticket['id']},
        {"$set": update_data}
    )
    
    # 4. Verify DB State
    updated_ticket = await db.tickets.find_one({"id": ticket['id']})
    print(f"Updated Ticket Status: {updated_ticket.get('status')}")
    print(f"Updated Ticket Agent: {updated_ticket.get('assigned_agent')}")
    
    # 5. Simulate Agent Query (get_tickets)
    # Logic from routers/tickets.py:
    # if current_user.role == "agent":
    #     if status == 'open': pass
    #     else: query['assigned_agent'] = current_user.id
    
    query = {}
    # Case A: status=None (All tickets tab)
    # It should filter by assigned_agent
    query['assigned_agent'] = agent['id']
    
    print(f"Querying with: {query}")
    results = await db.tickets.find(query).to_list(100)
    
    found = any(t['id'] == ticket['id'] for t in results)
    print(f"Ticket found in Agent's 'All' list? {found}")
    
    if not found:
        print("DEBUG: Why not found?")
        print(f"Ticket Agent in DB: '{updated_ticket.get('assigned_agent')}' (Type: {type(updated_ticket.get('assigned_agent'))})")
        print(f"Agent ID used in Query: '{agent['id']}' (Type: {type(agent['id'])})")

if __name__ == "__main__":
    asyncio.run(debug_claim())
