from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from datetime import datetime, timezone
import logging
import asyncio
import json
import uuid
import random
import string

from ..core.database import get_db, get_redis
from ..core.config import settings
from ..core.deps import get_current_user
from ..models.user import User
from ..models.ticket import Ticket, TicketCreate, TicketUpdate
from ..models.comment import Comment, CommentCreate, CommentCreateBot
from ..services.telegram import send_telegram_message
from ..core.logging import logger
from . import notifications

router = APIRouter()

@router.post("/", response_model=Ticket)
async def create_ticket(ticket_data: TicketCreate, current_user: User = Depends(get_current_user), db = Depends(get_db), redis = Depends(get_redis)):
    # Generate ticket number if not provided
    ticket_dict = ticket_data.model_dump()
    if not ticket_dict.get('ticket_number'):
        now = datetime.now()
        date_str = now.strftime("%m%d%Y%H%M%S")
        random_str = ''.join(random.choices(string.ascii_uppercase + string.digits, k=3))
        ticket_dict['ticket_number'] = f"INC{date_str}{random_str}"
        logger.info(f"Auto-generated ticket number: {ticket_dict['ticket_number']}")
    
    ticket = Ticket(**ticket_dict)
    
    ticket_dict = ticket.model_dump()
    ticket_dict['created_at'] = ticket_dict['created_at'].isoformat()
    
    await db.tickets.insert_one(ticket_dict)
    
    # Invalidate cache
    await redis.delete("dashboard:admin:stats:v2")
    
    return ticket

@router.get("/", response_model=List[Ticket])
async def get_tickets(
    status: Optional[str] = None,
    today_only: Optional[bool] = False,
    start_date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    logger.info(f"get_tickets called by {current_user.username} ({current_user.role}) with status={status}, today_only={today_only}, start_date={start_date}")
    query = {}
    if status:
        query['status'] = status
    
    # Filter by start_date if provided (preferred), else fallback to today_only (UTC)
    if start_date:
        query['created_at'] = {'$gte': start_date}
    elif today_only:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        query['created_at'] = {'$gte': today_start.isoformat()}
        
    if current_user.role == "agent":
        if status == 'open':
             pass
        else:
             query['assigned_agent'] = current_user.id
    
    logger.info(f"Querying tickets with: {query}")
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for t in tickets:
        if isinstance(t.get('created_at'), str):
            t['created_at'] = datetime.fromisoformat(t['created_at'])
        if t.get('updated_at') and isinstance(t.get('updated_at'), str):
            t['updated_at'] = datetime.fromisoformat(t['updated_at'])
        if t.get('completed_at') and isinstance(t.get('completed_at'), str):
            t['completed_at'] = datetime.fromisoformat(t['completed_at'])
            
    return [Ticket(**t) for t in tickets]

@router.get("/open/available", response_model=List[Ticket])
async def get_available_tickets(current_user: User = Depends(get_current_user), db = Depends(get_db)):
    query = {
        "status": "open",
        "assigned_agent": None
    }
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for t in tickets:
        if isinstance(t.get('created_at'), str):
            t['created_at'] = datetime.fromisoformat(t['created_at'])
            
    return [Ticket(**t) for t in tickets]

@router.get("/years")
async def get_ticket_years(current_user: User = Depends(get_current_user), db = Depends(get_db)):
    pipeline = [
        {"$match": {"created_at": {"$exists": True}}},
        {"$project": {"year": {"$toInt": {"$substr": ["$created_at", 0, 4]}}}},
        {"$group": {"_id": "$year"}},
        {"$sort": {"_id": -1}}
    ]
    years = await db.tickets.aggregate(pipeline).to_list(None)
    return {"years": [y["_id"] for y in years if y["_id"] is not None]}

@router.get("/categories")
async def get_ticket_categories(current_user: User = Depends(get_current_user), db = Depends(get_db)):
    categories = await db.tickets.distinct("category")
    return {"categories": sorted([c for c in categories if c])}

@router.get("/unread-replies")
async def get_unread_replies(current_user: User = Depends(get_current_user), db = Depends(get_db)):
    """Get list of ticket IDs with unread user comments (for badge display)"""
    logger.info(f"get_unread_replies called by {current_user.username}")
    # Find all comments from users that haven't been read by agents
    unread_comments = await db.comments.find(
        {"role": "user", "read_by_agent": False},
        {"_id": 0, "ticket_id": 1}
    ).to_list(1000)
    
    # Extract unique ticket IDs
    ticket_ids = list(set(comment['ticket_id'] for comment in unread_comments))
    
    return {"ticket_ids": ticket_ids}

@router.get("/{ticket_id}", response_model=Ticket)
async def get_ticket(ticket_id: str, current_user: User = Depends(get_current_user), db = Depends(get_db)):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    if isinstance(ticket.get('created_at'), str):
        ticket['created_at'] = datetime.fromisoformat(ticket['created_at'])
    if ticket.get('updated_at') and isinstance(ticket.get('updated_at'), str):
        ticket['updated_at'] = datetime.fromisoformat(ticket['updated_at'])
    if ticket.get('completed_at') and isinstance(ticket.get('completed_at'), str):
        ticket['completed_at'] = datetime.fromisoformat(ticket['completed_at'])
        
    return Ticket(**ticket)

@router.put("/{ticket_id}")
async def update_ticket(
    ticket_id: str,
    update_data: TicketUpdate,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db),
    redis = Depends(get_redis)
):
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket tidak ditemukan")
    
    if update_data.assigned_agent and ticket.get('assigned_agent') and ticket.get('assigned_agent') != update_data.assigned_agent:
        agent_name = ticket.get('assigned_agent_name', 'another agent')
        raise HTTPException(status_code=409, detail=f"Tiket sudah diambil oleh {agent_name}")
        
    update_dict = update_data.model_dump(exclude_unset=True)
    update_dict['updated_at'] = datetime.now(timezone.utc)
    
    if update_data.status == 'completed':
        update_dict['completed_at'] = datetime.now(timezone.utc)
        
    if 'assigned_agent' in update_dict and update_dict['assigned_agent'] is None:
        update_dict['assigned_agent_name'] = None
        update_dict['status'] = 'open'
    
    is_new_assignment = (
        update_data.assigned_agent and 
        update_data.assigned_agent != ticket.get('assigned_agent')
    )
    
    is_completed = (
        update_data.status == 'completed' and
        ticket.get('status') != 'completed'
    )

    logger.info(f"Updating ticket {ticket_id} with data: {update_dict}")
    logger.info(f"Current User ID: {current_user.id}")

    result = await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": update_dict}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Gagal memperbarui tiket")
        
    updated_ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    
    if is_new_assignment:
        logger.info(f"New assignment detected for ticket {ticket_id}. User ID: {updated_ticket.get('user_telegram_id')}")
        agent_name = updated_ticket.get('assigned_agent_name', 'Agent')
        ticket_number = updated_ticket.get('ticket_number', 'Unknown')
        user_name = updated_ticket.get('user_telegram_name', 'User')
        
        # Send notification to user (WITHOUT reply button)
        if updated_ticket.get('user_telegram_id'):
            message = (
                f"Halo *{user_name}*,\n\n"
                f"Tiket Anda *{ticket_number}* telah diambil oleh *{agent_name}*.\n"
                f"Mohon tunggu, kami sedang memprosesnya. 👨‍💻"
            )
            asyncio.create_task(send_telegram_message(updated_ticket.get('user_telegram_id'), message))  # No ticket_id = no reply button
        else:
            logger.warning(f"User Telegram ID tidak ditemukan untuk tiket {ticket_id}, skipping user notification")
        
        # Send notification to group
        if settings.GROUP_CHAT_ID:
            group_message = (
                f"📌 *Tiket Diambil*\n\n"
                f"Tiket *{ticket_number}* telah diambil oleh *{agent_name}*.\n"
                f"User: {user_name}\n"
                f"Kategori: {updated_ticket.get('category', '-')}"
            )
            asyncio.create_task(send_telegram_message(settings.GROUP_CHAT_ID, group_message))
        else:
            logger.warning(f"GROUP_CHAT_ID tidak ditemukan, skipping group notification")
            
    if is_completed:
        logger.info(f"Ticket {ticket_id} completed. Sending notification to User ID: {updated_ticket.get('user_telegram_id')}")
        if updated_ticket.get('user_telegram_id'):
            agent_name = updated_ticket.get('assigned_agent_name', 'Agent')
            ticket_number = updated_ticket.get('ticket_number', 'Unknown')
            user_name = updated_ticket.get('user_telegram_name', 'User')
            
            message = (
                f"Halo *{user_name}*,\n\n"
                f"Tiket Anda *{ticket_number}* telah *SELESAI* dikerjakan oleh *{agent_name}*.\n"
            )
            asyncio.create_task(send_telegram_message(updated_ticket.get('user_telegram_id'), message))
    
    await redis.delete("dashboard:admin:stats:v2")
    if ticket.get('assigned_agent'):
        await redis.delete(f"dashboard:agent:{ticket['assigned_agent']}:stats:v2")
    if update_data.assigned_agent:
        await redis.delete(f"dashboard:agent:{update_data.assigned_agent}:stats:v2")
        
    return Ticket(**updated_ticket)

@router.delete("/{ticket_id}")
async def delete_ticket(ticket_id: str, current_user: User = Depends(get_current_user), db = Depends(get_db), redis = Depends(get_redis)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Hak akses admin diperlukan")
        
    result = await db.tickets.delete_one({"id": ticket_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ticket tidak ditemukan")
        
    await redis.delete("dashboard:admin:stats:v2")
        
    return {"message": "Ticket deleted"}

@router.post("/{ticket_id}/comments", response_model=Comment)
async def add_comment(
    ticket_id: str,
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket tidak ditemukan")
    
    # Check if user is allowed to reply (only in_progress and pending)
    if current_user.role == "user" and ticket.get('status') not in ['in_progress', 'pending']:
        raise HTTPException(status_code=403, detail="Tidak dapat membalas tiket. Hanya tiket dengan status 'in progress' atau 'pending' yang dapat dibalas.")
    
    display_name = current_user.full_name if current_user.full_name else current_user.username
    
    comment = Comment(
        ticket_id=ticket_id,
        user_id=current_user.id,
        username=display_name,
        role=current_user.role,
        comment=comment_data.comment,
        sent_to_telegram=False
    )
    
    comment_dict = comment.model_dump()
    comment_dict['timestamp'] = comment_dict['timestamp'].isoformat()
    
    await db.comments.insert_one(comment_dict)
    
    logger.info(f"Comment added by {current_user.username} ({display_name}) on ticket {ticket['ticket_number']}, sending notification")
    
    # Send notification to user if comment is from agent
    if current_user.role == "agent" and ticket.get('user_telegram_id'):
        message = (
            f"💬 *Pesan Baru dari Agent*\n"
            f"Tiket: *{ticket['ticket_number']}*\n"
            f"Dari: *{display_name}*\n\n"
            f"{comment_data.comment}"
        )
        asyncio.create_task(send_telegram_message(ticket['user_telegram_id'], message, ticket_id=ticket_id))
        
        # TODO: Enable group notifications in the future
        # if settings.GROUP_CHAT_ID:
        #     username = ticket.get('user_telegram_name', 'User')
        #     group_message = (
        #         f"*Balasan Agent untuk Tiket {ticket['ticket_number']}*\n"
        #         f"Dari: *{display_name}*\n"
        #         f"Kepada: {username}\n\n"
        #         f"{comment_data.comment}"
        #     )
        #     asyncio.create_task(send_telegram_message(settings.GROUP_CHAT_ID, group_message))
    
    return comment

@router.post("/bot-comments", response_model=Comment)
async def add_bot_comment(
    comment_data: CommentCreateBot,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    if current_user.role not in ["admin", "agent"]:
        raise HTTPException(status_code=403, detail="Hak akses admin/agent diperlukan")
    
    ticket = await db.tickets.find_one({"ticket_number": comment_data.ticket_number})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket tidak ditemukan")
        
    if ticket.get('status') == 'completed':
        raise HTTPException(status_code=400, detail="Tiket sudah selesai, tidak dapat membalas.")
    
    comment = Comment(
        ticket_id=ticket['id'],
        user_id=comment_data.user_telegram_id,
        username=comment_data.user_telegram_name,
        role="user",
        comment=comment_data.comment,
        sent_to_telegram=True
    )
    
    comment_dict = comment.model_dump()
    comment_dict['timestamp'] = comment_dict['timestamp'].isoformat()
    
    await db.comments.insert_one(comment_dict)
    
    # Notify agents via WebSocket about new user reply
    try:
        await notifications.notify_new_reply(
            ticket_id=ticket['id'],
            ticket_number=ticket['ticket_number'],
            user_name=comment_data.user_telegram_name
        )
    except Exception as e:
        logger.error(f"Failed to send WebSocket notification: {e}")
    
    return comment

@router.get("/{ticket_id}/comments", response_model=List[Comment])
async def get_comments(ticket_id: str, current_user: User = Depends(get_current_user), db = Depends(get_db)):
    comments = await db.comments.find({"ticket_id": ticket_id}, {"_id": 0}).to_list(1000)
    
    for comment in comments:
        if isinstance(comment.get('timestamp'), str):
            comment['timestamp'] = datetime.fromisoformat(comment['timestamp'])
    
    return [Comment(**c) for c in comments]

@router.get("/comments/pending-telegram")
async def get_pending_telegram_comments(db = Depends(get_db)):
    comments = await db.comments.find(
        {"sent_to_telegram": False},
        {"_id": 0}
    ).to_list(1000)
    
    result = []
    for comment in comments:
        ticket = await db.tickets.find_one({"id": comment['ticket_id']}, {"_id": 0})
        if ticket:
            result.append({
                "comment_id": comment['id'],
                "ticket_id": comment['ticket_id'],
                "ticket_number": ticket['ticket_number'],
                "user_telegram_id": ticket['user_telegram_id'],
                "user_telegram_name": ticket['user_telegram_name'],
                "agent_username": comment['username'],
                "comment": comment['comment'],
                "timestamp": comment['timestamp']
            })
    
    return result

@router.put("/comments/{comment_id}/mark-sent")
async def mark_comment_as_sent(comment_id: str, db = Depends(get_db)):
    result = await db.comments.update_one(
        {"id": comment_id},
        {"$set": {"sent_to_telegram": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Komentar tidak ditemukan")
    
    return {"message": "Komentar berhasil disimpan"}



@router.put("/{ticket_id}/mark-read")
async def mark_ticket_read(ticket_id: str, current_user: User = Depends(get_current_user), db = Depends(get_db)):
    """Mark all user comments in this ticket as read (clear badge)"""
    # Only agents can mark as read
    if current_user.role != "agent":
        raise HTTPException(status_code=403, detail="Hak akses agent diperlukan")
    
    # Mark all user comments in this ticket as read
    result = await db.comments.update_many(
        {"ticket_id": ticket_id, "role": "user", "read_by_agent": False},
        {"$set": {"read_by_agent": True}}
    )
    
    logger.info(f"Marked {result.modified_count} comments as read for ticket {ticket_id}")
    
    return {"message": "Marked as read", "count": result.modified_count}
