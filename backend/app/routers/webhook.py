from fastapi import APIRouter, Depends
from datetime import datetime, timezone
import uuid
import random
import string
from ..core.database import get_db, get_redis
from ..models.ticket import Ticket, TicketCreate
from ..core.logging import logger

router = APIRouter()

class TelegramWebhookRequest(TicketCreate):
    """Request model for Telegram bot webhook - extends TicketCreate but ticket_number is optional"""
    ticket_number: str | None = None  # Override to make it optional

@router.post("/telegram", response_model=Ticket)
async def telegram_webhook(request: TelegramWebhookRequest, db = Depends(get_db), redis = Depends(get_redis)):
    """Endpoint for Telegram Bot to create tickets (No Auth required for bot)"""
    
    # Generate Ticket Number if not provided
    # Format: INC${MM}${DD}${YYYY}${HH}${mm}${ss}${randomText}
    # Example: INC111520251928405B6
    if not request.ticket_number:
        now = datetime.now()
        date_str = now.strftime("%m%d%Y%H%M%S")
        random_str = ''.join(random.choices(string.ascii_uppercase + string.digits, k=3))
        ticket_number = f"INC{date_str}{random_str}"
    else:
        ticket_number = request.ticket_number
    
    logger.info(f"Creating ticket from Telegram webhook: {ticket_number}")
    
    # Create Ticket object
    ticket_dict = request.model_dump(exclude={'ticket_number'})
    ticket_dict['ticket_number'] = ticket_number
    ticket_dict['status'] = 'open'
    ticket_dict['created_at'] = datetime.now(timezone.utc)
    ticket_dict['id'] = str(uuid.uuid4())
    ticket_dict['assigned_agent'] = None
    ticket_dict['assigned_agent_name'] = None
    
    # Insert into DB
    await db.tickets.insert_one({
        **ticket_dict,
        'created_at': ticket_dict['created_at'].isoformat()
    })
    
    # Invalidate cache
    await redis.delete("dashboard:admin:stats:v2")
    
    logger.info(f"Ticket {ticket_number} created successfully")
    
    # Return as Ticket model
    return Ticket(**ticket_dict)
