from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import pandas as pd
from fastapi.responses import StreamingResponse
import io
import random

import string
import redis.asyncio as redis
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.getenv('DB_NAME', 'telegram_ticket_db')]

# Redis connection
redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
redis_client = redis.from_url(redis_url, encoding="utf-8", decode_responses=True)

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-min-32-characters-long-please-change-this')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Create the main app without a prefix
app = FastAPI()

# Add CORS middleware (MUST be before router inclusion)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============= Models =============

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    full_name: Optional[str] = None
    role: str  # "admin" or "agent"
    status: str = "pending"  # "pending" or "approved"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    username: str
    full_name: str
    password: str
    role: str = "agent"


class UserLogin(BaseModel):
    username: str
    password: str

class TicketCreate(BaseModel):
    ticket_number: str
    user_telegram_id: str
    user_telegram_name: str
    category: str
    description: str
    permintaan: Optional[str] = None
    tipe_transaksi: Optional[str] = None
    order_number: Optional[str] = None
    wonum: Optional[str] = None
    tiket_fo: Optional[str] = None
    nd_internet_voice: Optional[str] = None
    password: Optional[str] = None
    paket_inet: Optional[str] = None
    sn_lama: Optional[str] = None
    sn_baru: Optional[str] = None
    sn_ap: Optional[str] = None
    mac_ap: Optional[str] = None
    ssid: Optional[str] = None
    tipe_ont: Optional[str] = None
    gpon_slot_port: Optional[str] = None
    vlan: Optional[str] = None
    svlan: Optional[str] = None
    cvlan: Optional[str] = None
    task_bima: Optional[str] = None
    ownergroup: Optional[str] = None
    link_chat: Optional[str] = None
    keterangan_lainnya: Optional[str] = None

class Ticket(TicketCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: str = "open" # open, pending, in_progress, completed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    assigned_agent: Optional[str] = None
    assigned_agent_name: Optional[str] = None

class CommentCreate(BaseModel):
    comment: str

class Comment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticket_id: str
    user_id: str
    username: str
    role: str
    comment: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    sent_to_telegram: bool = False

class AgentPerformance(BaseModel):
    id: str
    username: str
    total_tickets: int
    completed: int
    in_progress: int
    avg_time: float
    rating: float

class DashboardStats(BaseModel):
    total_tickets: int
    open_tickets: int
    pending_tickets: int
    in_progress_tickets: int
    completed_tickets: int
    tickets_today: int
    avg_completion_time_hours: float
    agent_performance: List[AgentPerformance]

class AgentStats(BaseModel):
    total_tickets: int
    completed_tickets: int
    in_progress_tickets: int
    avg_completion_time_hours: float
    rating: float

# Security Utilities
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = await db.users.find_one({"username": username})
    if user is None:
        raise credentials_exception
        
    return User(**user)

def parse_datetime(dt):
    if dt is None:
        return None
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt

@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate):
    # Check if username exists
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    user = User(
        username=user_data.username,
        full_name=user_data.full_name,
        role=user_data.role,
        status="pending" # All new registrations must be approved by admin
    )
    
    user_dict = user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    user_dict['password_hash'] = hashed_password
    
    await db.users.insert_one(user_dict)
    return user


@api_router.post("/auth/login")
async def login(form_data: UserLogin):
    user = await db.users.find_one({"username": form_data.username})
    if not user or not verify_password(form_data.password, user['password_hash']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if user['status'] != 'approved':
        raise HTTPException(status_code=400, detail="Account not approved yet")
        
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user['username'], "role": user['role'], "id": user['id']},
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer", "user": User(**user)}

@api_router.get("/users/pending", response_model=List[User])
async def get_pending_users(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({"status": "pending"}, {"_id": 0}).to_list(1000)
    return [User(**u) for u in users]

@api_router.get("/users/agents", response_model=List[User])
async def get_agents(current_user: User = Depends(get_current_user)):
    # Allow agents to see other agents for assignment if needed, or just admin
    # For now, let's allow both
    users = await db.users.find({"role": "agent", "status": "approved"}, {"_id": 0}).to_list(1000)
    return [User(**u) for u in users]

@api_router.put("/users/{user_id}/approve")
async def approve_user(
    user_id: str, 
    role: str = "agent", # Default to agent if not specified
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if role not in ["agent", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"status": "approved", "role": role}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": f"User approved as {role}"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.users.delete_one({"id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted"}

class ResetPasswordRequest(BaseModel):
    new_password: str

@api_router.put("/users/{user_id}/reset-password")
async def reset_password(user_id: str, request: ResetPasswordRequest, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    hashed_password = get_password_hash(request.new_password)
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": hashed_password}}
    )
    
    if result.modified_count == 0:
        # Check if user exists but password is same (not modified)
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Password reset successfully"}

@api_router.post("/tickets", response_model=Ticket)
async def create_ticket(ticket_data: TicketCreate, current_user: User = Depends(get_current_user)):
    # Usually tickets are created by Bot, but maybe Admin can create too?
    # For now, let's allow authenticated users
    ticket = Ticket(**ticket_data.model_dump())
    
    ticket_dict = ticket.model_dump()
    ticket_dict['created_at'] = ticket_dict['created_at'].isoformat()
    
    await db.tickets.insert_one(ticket_dict)
    
    # Invalidate cache
    await redis_client.delete("dashboard:admin:stats:v2")
    
    return ticket

@api_router.get("/tickets", response_model=List[Ticket])
async def get_tickets(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    if status:
        query['status'] = status
        
    if current_user.role == "agent":
        # Agents see their assigned tickets
        # AND tickets they can claim (open tickets)?
        # For "My Tickets" tab, usually assigned to them
        # But if status is "open", they might want to see available ones
        if status == 'open':
             # Open tickets are unassigned or assigned to them?
             # Usually "open" means unassigned in this context
             pass
        else:
             query['assigned_agent'] = current_user.id
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Convert datetime strings back to datetime objects for Pydantic
    for t in tickets:
        if isinstance(t.get('created_at'), str):
            t['created_at'] = datetime.fromisoformat(t['created_at'])
        if t.get('updated_at') and isinstance(t.get('updated_at'), str):
            t['updated_at'] = datetime.fromisoformat(t['updated_at'])
        if t.get('completed_at') and isinstance(t.get('completed_at'), str):
            t['completed_at'] = datetime.fromisoformat(t['completed_at'])
            
    return [Ticket(**t) for t in tickets]

@api_router.get("/tickets/open/available", response_model=List[Ticket])
async def get_available_tickets(current_user: User = Depends(get_current_user)):
    # Tickets that are open and NOT assigned
    query = {
        "status": "open",
        "assigned_agent": None
    }
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for t in tickets:
        if isinstance(t.get('created_at'), str):
            t['created_at'] = datetime.fromisoformat(t['created_at'])
            
    return [Ticket(**t) for t in tickets]

@api_router.get("/tickets/{ticket_id}", response_model=Ticket)
async def get_ticket(ticket_id: str, current_user: User = Depends(get_current_user)):
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

class TicketUpdate(BaseModel):
    status: Optional[str] = None
    assigned_agent: Optional[str] = None
    assigned_agent_name: Optional[str] = None

@api_router.put("/tickets/{ticket_id}")
async def update_ticket(
    ticket_id: str,
    update_data: TicketUpdate,
    current_user: User = Depends(get_current_user)
):
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Check for conflict if assigning agent
    if update_data.assigned_agent and ticket.get('assigned_agent') and ticket.get('assigned_agent') != update_data.assigned_agent:
        # If ticket is already assigned to someone else
        raise HTTPException(status_code=409, detail="Ticket already assigned to another agent")
        
    update_dict = update_data.model_dump(exclude_unset=True)
    update_dict['updated_at'] = datetime.now(timezone.utc)
    
    if update_data.status == 'completed':
        update_dict['completed_at'] = datetime.now(timezone.utc)
        
    # If unassigning (assigned_agent is explicitly None)
    if 'assigned_agent' in update_dict and update_dict['assigned_agent'] is None:
        update_dict['assigned_agent_name'] = None
        update_dict['status'] = 'open' # Revert to open if unassigned?
        
    await db.tickets.update_one({"id": ticket_id}, {"$set": update_dict})
    
    # Invalidate cache
    await redis_client.delete("dashboard:admin:stats:v2")
    if ticket.get('assigned_agent'):
        await redis_client.delete(f"dashboard:agent:{ticket['assigned_agent']}:stats:v2")
    if update_data.assigned_agent:
        await redis_client.delete(f"dashboard:agent:{update_data.assigned_agent}:stats:v2")
        
    return {"message": "Ticket updated"}

@api_router.delete("/tickets/{ticket_id}")
async def delete_ticket(ticket_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    result = await db.tickets.delete_one({"id": ticket_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    # Invalidate cache
    await redis_client.delete("dashboard:admin:stats:v2")
        
    return {"message": "Ticket deleted"}


@api_router.post("/tickets/{ticket_id}/comments", response_model=Comment)
async def add_comment(
    ticket_id: str,
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_user)
):
    # Check if ticket exists
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Create comment with sent_to_telegram=False (bot will pick this up)
    # Use full_name if available, otherwise username
    display_name = current_user.full_name if current_user.full_name else current_user.username
    
    comment = Comment(
        ticket_id=ticket_id,
        user_id=current_user.id,
        username=display_name, # Store display name in username field for compatibility
        role=current_user.role,
        comment=comment_data.comment,
        sent_to_telegram=False  # Bot needs to send this to user
    )
    
    comment_dict = comment.model_dump()
    comment_dict['timestamp'] = comment_dict['timestamp'].isoformat()
    
    await db.comments.insert_one(comment_dict)
    
    logger.info(f"Comment added by {current_user.username} ({display_name}) on ticket {ticket['ticket_number']}, awaiting bot notification")
    
    return comment

class CommentCreateBot(BaseModel):
    ticket_number: str
    user_telegram_id: str
    user_telegram_name: str
    comment: str

@api_router.post("/bot/comments", response_model=Comment)
async def add_bot_comment(
    comment_data: CommentCreateBot,
    current_user: User = Depends(get_current_user)
):
    """Endpoint for Bot to add comment on behalf of Telegram User"""
    # Bot must be admin/agent to use this
    if current_user.role not in ["admin", "agent"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Find ticket by ticket_number
    ticket = await db.tickets.find_one({"ticket_number": comment_data.ticket_number})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Create comment
    comment = Comment(
        ticket_id=ticket['id'],
        user_id=comment_data.user_telegram_id, # Use telegram ID as user_id
        username=comment_data.user_telegram_name,
        role="user", # Role is user
        comment=comment_data.comment,
        sent_to_telegram=True # No need to send back to telegram as it comes from there
    )
    
    comment_dict = comment.model_dump()
    comment_dict['timestamp'] = comment_dict['timestamp'].isoformat()
    
    await db.comments.insert_one(comment_dict)
    
    return comment

@api_router.get("/tickets/{ticket_id}/comments", response_model=List[Comment])
async def get_comments(ticket_id: str, current_user: User = Depends(get_current_user)):
    comments = await db.comments.find({"ticket_id": ticket_id}, {"_id": 0}).to_list(1000)
    
    for comment in comments:
        if isinstance(comment.get('timestamp'), str):
            comment['timestamp'] = datetime.fromisoformat(comment['timestamp'])
    
    return [Comment(**c) for c in comments]

@api_router.get("/comments/pending-telegram")
async def get_pending_telegram_comments():
    """Get comments that need to be sent to Telegram bot (for bot polling)"""
    # Find all comments not yet sent to telegram
    comments = await db.comments.find(
        {"sent_to_telegram": False},
        {"_id": 0}
    ).to_list(1000)
    
    # Get ticket info for each comment
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

@api_router.put("/comments/{comment_id}/mark-sent")
async def mark_comment_as_sent(comment_id: str):
    """Mark comment as sent to Telegram (called by bot after sending)"""
    result = await db.comments.update_one(
        {"id": comment_id},
        {"$set": {"sent_to_telegram": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    return {"message": "Comment marked as sent to Telegram"}

# ============= Statistics Routes =============

# New Dashboard endpoint for Admin
@api_router.get("/statistics/admin-dashboard")
async def get_admin_dashboard(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Try to get from cache first
    cache_key = "dashboard:admin:stats:v2"
    cached_stats = await redis_client.get(cache_key)
    if cached_stats:
        return json.loads(cached_stats)
    
    all_tickets = await db.tickets.find({}, {"_id": 0}).to_list(10000)
    
    # Today
    today = datetime.now(timezone.utc).date()
    today_tickets = []
    for t in all_tickets:
        dt = parse_datetime(t.get('created_at'))
        if dt:
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if dt.date() == today:
                today_tickets.append(t)
    
    # This month
    this_month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_tickets = []
    for t in all_tickets:
        dt = parse_datetime(t.get('created_at'))
        if dt:
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if dt >= this_month_start:
                month_tickets.append(t)
    
    # Calculate stats
    # Note: "open" shows ALL currently open tickets in the system, not just today's
    today_stats = {
        "received": len(today_tickets),
        "completed": sum(1 for t in today_tickets if t['status'] == 'completed'),
        "in_progress": sum(1 for t in today_tickets if t['status'] == 'in_progress'),
        "open": sum(1 for t in all_tickets if t['status'] == 'open')  # All open tickets
    }
    
    # Month avg time
    month_completed = [t for t in month_tickets if t['status'] == 'completed' and t.get('completed_at')]
    month_times = []
    for t in month_completed:
        created = parse_datetime(t.get('created_at'))
        completed = parse_datetime(t.get('completed_at'))
        if created and completed:
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            if completed.tzinfo is None:
                completed = completed.replace(tzinfo=timezone.utc)
            month_times.append((completed - created).total_seconds() / 3600)
    
    # Get active agents this month (agents with assigned tickets)
    month_agents = set(t.get('assigned_agent') for t in month_tickets if t.get('assigned_agent'))
    
    month_stats = {
        "received": len(month_tickets),
        "completed": len(month_completed),
        "avg_time": sum(month_times) / len(month_times) if month_times else 0,
        "active_agents": len(month_agents)
    }
    
    # Total
    total_completed = sum(1 for t in all_tickets if t['status'] == 'completed')
    total_agents_count = await db.users.count_documents({"role": "agent", "status": "approved"})
    
    total_stats = {
        "all_tickets": len(all_tickets),
        "completed": total_completed,
        "total_agents": total_agents_count
    }
    
    result = {
        "today": today_stats,
        "this_month": month_stats,
        "total": total_stats
    }
    
    # Save to cache (expire in 5 minutes)
    await redis_client.setex(cache_key, 300, json.dumps(result))
    
    return result


# New Dashboard endpoint for Agent
@api_router.get("/statistics/agent-dashboard/{agent_id}")
async def get_agent_dashboard(agent_id: str, current_user: User = Depends(get_current_user)):
    # Agents can only see their own dashboard
    if current_user.role == "agent" and current_user.id != agent_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Try cache
    cache_key = f"dashboard:agent:{agent_id}:stats:v2"
    cached_stats = await redis_client.get(cache_key)
    if cached_stats:
        return json.loads(cached_stats)
    
    all_tickets = await db.tickets.find({"assigned_agent": agent_id}, {"_id": 0}).to_list(10000)
    
    # Today
    today = datetime.now(timezone.utc).date()
    today_tickets = []
    for t in all_tickets:
        dt = parse_datetime(t.get('created_at'))
        if dt and dt.date() == today:
            today_tickets.append(t)
    
    # This month
    this_month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_tickets = []
    for t in all_tickets:
        dt = parse_datetime(t.get('created_at'))
        if dt and dt >= this_month_start:
            month_tickets.append(t)
    
    # Calculate stats
    today_stats = {
        "received": len(today_tickets),
        "completed": sum(1 for t in today_tickets if t['status'] == 'completed'),
        "in_progress": sum(1 for t in today_tickets if t['status'] == 'in_progress'),
        "pending": sum(1 for t in today_tickets if t['status'] == 'pending')
    }
    
    # Month avg time
    month_completed = [t for t in month_tickets if t['status'] == 'completed' and t.get('completed_at')]
    month_times = []
    for t in month_completed:
        created = parse_datetime(t.get('created_at'))
        completed = parse_datetime(t.get('completed_at'))
        if created and completed:
            month_times.append((completed - created).total_seconds() / 3600)
    
    month_stats = {
        "received": len(month_tickets),
        "completed": len(month_completed),
        "avg_time": sum(month_times) / len(month_times) if month_times else 0
    }
    
    # Total
    total_completed = sum(1 for t in all_tickets if t['status'] == 'completed')
    
    total_stats = {
        "all_tickets": len(all_tickets),
        "completed": total_completed
    }
    
    result = {
        "today": today_stats,
        "this_month": month_stats,
        "total": total_stats
    }
    
    # Save to cache
    await redis_client.setex(cache_key, 300, json.dumps(result))
    
    return result

@api_router.get("/statistics/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get all tickets
    all_tickets = await db.tickets.find({}, {"_id": 0}).to_list(10000)
    
    total_tickets = len(all_tickets)
    open_tickets = sum(1 for t in all_tickets if t['status'] == 'open')
    pending_tickets = sum(1 for t in all_tickets if t['status'] == 'pending')
    in_progress_tickets = sum(1 for t in all_tickets if t['status'] == 'in_progress')
    completed_tickets = sum(1 for t in all_tickets if t['status'] == 'completed')
    
    # Tickets today
    today = datetime.now(timezone.utc).date()
    tickets_today = 0
    for t in all_tickets:
        created_at = parse_datetime(t.get('created_at'))
        if created_at and created_at.date() == today:
            tickets_today += 1
    
    # Avg completion time
    completion_times = []
    for t in all_tickets:
        if t['status'] == 'completed' and t.get('completed_at'):
            created_at = parse_datetime(t.get('created_at'))
            completed_at = parse_datetime(t.get('completed_at'))
            if created_at and completed_at:
                time_diff = (completed_at - created_at).total_seconds() / 3600
                completion_times.append(time_diff)
    
    avg_completion_time = sum(completion_times) / len(completion_times) if completion_times else 0
    
    # Agent performance
    agents = await db.users.find({"role": "agent", "status": "approved"}, {"_id": 0}).to_list(1000)
    agent_performance = []
    
    for agent in agents:
        agent_tickets = [t for t in all_tickets if t.get('assigned_agent') == agent['id']]
        agent_completed = [t for t in agent_tickets if t['status'] == 'completed']
        
        agent_completion_times = []
        for t in agent_completed:
            if t.get('completed_at'):
                created_at = parse_datetime(t.get('created_at'))
                completed_at = parse_datetime(t.get('completed_at'))
                if created_at and completed_at:
                    time_diff = (completed_at - created_at).total_seconds() / 3600
                    agent_completion_times.append(time_diff)
        
        avg_time = sum(agent_completion_times) / len(agent_completion_times) if agent_completion_times else 0
        rating = 5.0 if len(agent_completed) > 0 else 0
        
        agent_performance.append({
            "id": agent['id'],
            "username": agent['username'],
            "total_tickets": len(agent_tickets),
            "completed": len(agent_completed),
            "in_progress": sum(1 for t in agent_tickets if t['status'] == 'in_progress'),
            "avg_time": round(avg_time, 2),
            "rating": rating
        })
    
    return DashboardStats(
        total_tickets=total_tickets,
        open_tickets=open_tickets,
        pending_tickets=pending_tickets,
        in_progress_tickets=in_progress_tickets,
        completed_tickets=completed_tickets,
        tickets_today=tickets_today,
        avg_completion_time_hours=round(avg_completion_time, 2),
        agent_performance=agent_performance
    )

@api_router.get("/statistics/agent/{agent_id}", response_model=AgentStats)
async def get_agent_stats(agent_id: str, current_user: User = Depends(get_current_user)):
    # Agents can only see their own stats
    if current_user.role == "agent" and current_user.id != agent_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get agent tickets
    tickets = await db.tickets.find({"assigned_agent": agent_id}, {"_id": 0}).to_list(10000)
    
    total_tickets = len(tickets)
    completed_tickets = sum(1 for t in tickets if t['status'] == 'completed')
    in_progress_tickets = sum(1 for t in tickets if t['status'] == 'in_progress')
    
    # Avg completion time
    completion_times = []
    for t in tickets:
        if t['status'] == 'completed' and t.get('completed_at'):
            created_at = parse_datetime(t.get('created_at'))
            completed_at = parse_datetime(t.get('completed_at'))
            if created_at and completed_at:
                time_diff = (completed_at - created_at).total_seconds() / 3600
                completion_times.append(time_diff)
    
    avg_completion_time = sum(completion_times) / len(completion_times) if completion_times else 0
    rating = 5.0 if completed_tickets > 0 else 0
    
    return AgentStats(
        total_tickets=total_tickets,
        completed_tickets=completed_tickets,
        in_progress_tickets=in_progress_tickets,
        avg_completion_time_hours=round(avg_completion_time, 2),
        rating=rating
    )

# ============= Export Route =============

@api_router.get("/export/tickets")
async def export_tickets(
    format: str = "csv",
    current_user: User = Depends(get_current_user)
):
    """Export tickets to CSV or XLSX"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    tickets = await db.tickets.find({}, {"_id": 0}).to_list(10000)
    
    # Prepare export data with formatted dates
    export_data = []
    for ticket in tickets:
        # Format dates
        created_at = ticket.get('created_at', '')
        if created_at:
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at)
            created_at_str = created_at.strftime('%Y-%m-%d %H:%M:%S')
        else:
            created_at_str = ''
        
        updated_at = ticket.get('updated_at', '')
        if updated_at:
            if isinstance(updated_at, str):
                updated_at = datetime.fromisoformat(updated_at)
            updated_at_str = updated_at.strftime('%Y-%m-%d %H:%M:%S')
        else:
            updated_at_str = ''
        
        completed_at = ticket.get('completed_at', '')
        if completed_at:
            if isinstance(completed_at, str):
                completed_at = datetime.fromisoformat(completed_at)
            completed_at_str = completed_at.strftime('%Y-%m-%d %H:%M:%S')
        else:
            completed_at_str = ''
        
        export_data.append({
            'Ticket Number': ticket.get('ticket_number', ''),
            'Created Date': created_at_str,
            'Updated Date': updated_at_str,
            'Completed Date': completed_at_str,
            'User Telegram ID': ticket.get('user_telegram_id', ''),
            'User Telegram Name': ticket.get('user_telegram_name', ''),
            'Category': ticket.get('category', ''),
            'Description': ticket.get('description', ''),
            'Status': ticket.get('status', ''),
            'Assigned Agent': ticket.get('assigned_agent_name', ''),
        })
    
    # Convert to DataFrame
    df = pd.DataFrame(export_data)
    
    if format == "xlsx":
        # Create Excel file
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Tickets')
        output.seek(0)
        
        response = StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response.headers["Content-Disposition"] = "attachment; filename=tickets_export.xlsx"
    else:
        # Create CSV
        stream = io.StringIO()
        df.to_csv(stream, index=False)
        response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
        response.headers["Content-Disposition"] = "attachment; filename=tickets_export.csv"
    
    return response


@api_router.get("/performance/table-data")
async def get_performance_table_data(
    year: Optional[int] = None,
    month: Optional[int] = None,
    category: Optional[str] = None,
    agent_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    match_stage = {}
    
    if year:
        start_date = datetime(year, 1, 1)
        end_date = datetime(year + 1, 1, 1)
        match_stage["created_at"] = {"$gte": start_date, "$lt": end_date}
        
    if month and year:
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        match_stage["created_at"] = {"$gte": start_date, "$lt": end_date}
        
    if category and category != 'all':
        match_stage["category"] = category
        
    if agent_id and agent_id != 'all':
        match_stage["assigned_agent"] = agent_id

    # Pipeline for Product/Category Performance
    pipeline = [
        {"$match": match_stage},
        {"$group": {
            "_id": {
                "product": "$category",
                "type": "$permintaan"
            },
            "count": {"$sum": 1}
        }},
        {"$group": {
            "_id": "$_id.product",
            "types": {
                "$push": {
                    "k": {"$ifNull": ["$_id.type", "Unknown"]},
                    "v": "$count"
                }
            }
        }},
        {"$project": {
            "product": "$_id",
            "counts": {"$arrayToObject": "$types"},
            "_id": 0
        }},
        {"$sort": {"product": 1}}
    ]
    
    results = await db.tickets.aggregate(pipeline).to_list(None)
    
    # Format data for frontend
    data = []
    grand_total = {
        "INTEGRASI": 0, "PUSH BIMA": 0, "RECONFIG": 0, 
        "REPLACE ONT": 0, "TROUBLESHOOT": 0, "total": 0
    }
    
    for item in results:
        row = {"product": item['product']}
        counts = item.get('counts', {})
        
        # Add specific columns expected by frontend
        for key in ["INTEGRASI", "PUSH BIMA", "RECONFIG", "REPLACE ONT", "TROUBLESHOOT"]:
            val = counts.get(key, 0)
            row[key] = val
            grand_total[key] += val
            grand_total["total"] += val
            
        data.append(row)
        
    return {
        "data": data,
        "grand_total": grand_total,
        "summary": {} # Legacy support if needed
    }

@api_router.get("/performance/by-agent")
async def get_performance_by_agent(
    year: Optional[int] = None,
    month: Optional[int] = None,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    match_stage = {"assigned_agent": {"$ne": None}}
    
    if year:
        start_date = datetime(year, 1, 1)
        end_date = datetime(year + 1, 1, 1)
        match_stage["created_at"] = {"$gte": start_date, "$lt": end_date}
        
    if month and year:
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        match_stage["created_at"] = {"$gte": start_date, "$lt": end_date}
        
    if category and category != 'all':
        match_stage["category"] = category

    pipeline = [
        {"$match": match_stage},
        {"$group": {
            "_id": {
                "agent": "$assigned_agent_name",
                "type": "$permintaan"
            },
            "count": {"$sum": 1}
        }},
        {"$group": {
            "_id": "$_id.agent",
            "total": {"$sum": "$count"},
            "types": {
                "$push": {
                    "k": {"$ifNull": ["$_id.type", "Unknown"]},
                    "v": "$count"
                }
            }
        }},
        {"$project": {
            "agent": "$_id",
            "total": 1,
            "counts": {"$arrayToObject": "$types"},
            "_id": 0
        }},
        {"$sort": {"total": -1}}
    ]
    
    results = await db.tickets.aggregate(pipeline).to_list(None)
    
    data = []
    grand_total = {
        "INTEGRASI": 0, "PUSH BIMA": 0, "RECONFIG": 0, 
        "REPLACE ONT": 0, "TROUBLESHOOT": 0, "total": 0
    }
    
    for item in results:
        row = {
            "agent": item['agent'] or "Unknown", 
            "total": item['total']
        }
        counts = item.get('counts', {})
        
        for key in ["INTEGRASI", "PUSH BIMA", "RECONFIG", "REPLACE ONT", "TROUBLESHOOT"]:
            val = counts.get(key, 0)
            row[key] = val
            grand_total[key] += val
            
        grand_total["total"] += item['total']
        data.append(row)
        
    return {
        "data": data,
        "grand_total": grand_total
    }

@api_router.get("/export/performance")
async def export_performance_report(
    year: Optional[int] = None,
    month: Optional[int] = None,  # 1-12
    category: Optional[str] = None,
    agent_id: Optional[str] = None,
    format: str = "csv",
    current_user: User = Depends(get_current_user)
):
    """Export detailed performance report with ticket-level data
    - year: Filter by year (e.g., 2025)
    - month: Filter by month (1-12)
    - category: Filter by ticket category
    - agent_id: Filter by specific agent
    - format: csv or xlsx
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Build query
    query = {}
    
    # Year and Month filter
    if year or month:
        if year and not month:
            start_date = datetime(year, 1, 1, tzinfo=timezone.utc)
            end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        elif month and not year:
            current_year = datetime.now(timezone.utc).year
            start_date = datetime(current_year, month, 1, tzinfo=timezone.utc)
            if month == 12:
                end_date = datetime(current_year + 1, 1, 1, tzinfo=timezone.utc)
            else:
                end_date = datetime(current_year, month + 1, 1, tzinfo=timezone.utc)
        else:
            start_date = datetime(year, month, 1, tzinfo=timezone.utc)
            if month == 12:
                end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
            else:
                end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)
        
        query['created_at'] = {
            '$gte': start_date.isoformat(),
            '$lt': end_date.isoformat()
        }
    
    if category:
        query['category'] = category
    
    if agent_id:
        query['assigned_agent'] = agent_id
    
    # Get all tickets matching filters
    tickets = await db.tickets.find(query, {"_id": 0}).to_list(10000)
    
    # Prepare detailed export data
    export_data = []
    
    for ticket in tickets:
        # Calculate duration
        duration_hours = None
        duration_category = ""
        
        if ticket['status'] == 'completed' and ticket.get('completed_at'):
            created = datetime.fromisoformat(ticket['created_at'] if isinstance(ticket['created_at'], str) else ticket['created_at'].isoformat())
            completed_time = datetime.fromisoformat(ticket['completed_at'] if isinstance(ticket['completed_at'], str) else ticket['completed_at'].isoformat())
            duration_hours = round((completed_time - created).total_seconds() / 3600, 2)
            
            # Categorize duration
            if duration_hours < 1:
                duration_category = "< 1 hour"
            elif 2 <= duration_hours <= 3:
                duration_category = "2-3 hours"
            elif duration_hours > 3:
                duration_category = "> 3 hours"
        
        # Format dates for export
        created_at = ticket.get('created_at', '')
        if created_at:
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at)
            created_at_str = created_at.strftime('%Y-%m-%d %H:%M:%S')
        else:
            created_at_str = ''
        
        completed_at = ticket.get('completed_at', '')
        if completed_at:
            if isinstance(completed_at, str):
                completed_at = datetime.fromisoformat(completed_at)
            completed_at_str = completed_at.strftime('%Y-%m-%d %H:%M:%S')
        else:
            completed_at_str = ''
        
        # Get comments for this ticket
        comments = await db.comments.find({"ticket_id": ticket['id']}, {"_id": 0}).to_list(100)
        comment_text = "; ".join([f"{c.get('username')}: {c.get('comment')}" for c in comments]) if comments else ''
        
        # Calculate duration in minutes
        duration_minutes = None
        if duration_hours:
            duration_minutes = round(duration_hours * 60, 2)
        
        # Get period (month/year)
        period = ''
        if created_at:
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at)
            period = created_at.strftime('%B %Y')
        
        export_data.append({
            'TANGGAL OPEN': created_at_str,
            'TIKET LAPORAN': ticket.get('ticket_number', ''),
            'PRODUCT': ticket.get('category', ''),
            'TIPE TRANSAKSI': ticket.get('tipe_transaksi', ''),
            'PERMINTAAN': ticket.get('permintaan', ''),
            'ORDER': ticket.get('order_number', ''),
            'WONUM': ticket.get('wonum', ''),
            'TIKET FO': ticket.get('tiket_fo', ''),
            'ND INTERNET/VOICE/SID': ticket.get('nd_internet_voice', ''),
            'PASSWORD': ticket.get('password', ''),
            'PAKET INET': ticket.get('paket_inet', ''),
            'SN LAMA': ticket.get('sn_lama', ''),
            'SN BARU': ticket.get('sn_baru', ''),
            'SN AP': ticket.get('sn_ap', ''),
            'MAC AP': ticket.get('mac_ap', ''),
            'SSID': ticket.get('ssid', ''),
            'TIPE ONT': ticket.get('tipe_ont', ''),
            'GPON SLOT/PORT': ticket.get('gpon_slot_port', ''),
            'VLAN': ticket.get('vlan', ''),
            'SVLAN': ticket.get('svlan', ''),
            'CVLAN': ticket.get('cvlan', ''),
            'TASK BIMA': ticket.get('task_bima', ''),
            'OWNERGROUP': ticket.get('ownergroup', ''),
            'LINK CHAT': ticket.get('link_chat', ''),
            'KETERANGAN LAINNYA': ticket.get('keterangan_lainnya', ''),
            'HD ROC': ticket.get('assigned_agent_name', ''),
            'ACTION': ticket.get('status', ''),
            'NOTE': comment_text,
            'TANGGAL UPDATE': completed_at_str,
            'PELAPOR': ticket.get('user_telegram_name', ''),
            'ID PELAPOR': ticket.get('user_telegram_id', ''),
            'DURASI TIKET': duration_hours if duration_hours else '',
            'MENIT TOTAL': duration_minutes if duration_minutes else '',
            'KAT DURASI': duration_category,
            'PERIODE': period
        })
    
    # Sort by agent name
    export_data.sort(key=lambda x: (x['HD ROC'] or '', x['TIKET LAPORAN']))
    
    # Create DataFrame
    df = pd.DataFrame(export_data)
    
    if format == "xlsx":
        # Create Excel file
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Performance Report')
        output.seek(0)
        
        response = StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        year_str = str(year) if year else 'all'
        month_str = str(month) if month else 'all'
        category_str = category.replace(' ', '_') if category else 'all'
        agent_str = agent_id or 'all_agents'
        filename = f"performance_report_{year_str}_{month_str}_{category_str}_{agent_str}.xlsx"
        response.headers["Content-Disposition"] = f"attachment; filename={filename}"
    else:
        # Create CSV
        stream = io.StringIO()
        df.to_csv(stream, index=False)
        response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
        year_str = str(year) if year else 'all'
        month_str = str(month) if month else 'all'
        category_str = category.replace(' ', '_') if category else 'all'
        agent_str = agent_id or 'all_agents'
        filename = f"performance_report_{year_str}_{month_str}_{category_str}_{agent_str}.csv"
        response.headers["Content-Disposition"] = f"attachment; filename={filename}"
    
    return response

@api_router.post("/users/create-admin")
async def create_second_admin(current_user: User = Depends(get_current_user)):
    """Create a second admin user (admin2) - Admin only"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if admin2 already exists
    existing_admin = await db.users.find_one({"username": "admin2"})
    if existing_admin:
        raise HTTPException(status_code=400, detail="Admin2 already exists")
    
    # Create admin2
    admin2_user = User(
        username="admin2",
        role="admin",
        status="approved"
    )
    admin2_dict = admin2_user.model_dump()
    admin2_dict['created_at'] = admin2_dict['created_at'].isoformat()
    admin2_dict['password_hash'] = get_password_hash("admin123")
    
    await db.users.insert_one(admin2_dict)
    
    return {
        "message": "Admin2 created successfully",
        "username": "admin2",
        "password": "admin123",
        "role": "admin"
    }



# ============= PERFORMANCE REPORT BY AGENT & PRODUCT =============

@api_router.get("/performance/by-agent")
async def get_performance_by_agent(
    year: Optional[int] = None,
    month: Optional[int] = None,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get performance report grouped by agent and permintaan type"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Build query for filtering tickets
    query = {}
    
    # Year and Month filter
    if year or month:
        if year and not month:
            start_date = datetime(year, 1, 1, tzinfo=timezone.utc)
            end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        elif month and not year:
            current_year = datetime.now(timezone.utc).year
            start_date = datetime(current_year, month, 1, tzinfo=timezone.utc)
            if month == 12:
                end_date = datetime(current_year + 1, 1, 1, tzinfo=timezone.utc)
            else:
                end_date = datetime(current_year, month + 1, 1, tzinfo=timezone.utc)
        else:
            start_date = datetime(year, month, 1, tzinfo=timezone.utc)
            if month == 12:
                end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
            else:
                end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)
        
        query['created_at'] = {
            '$gte': start_date.isoformat(),
            '$lt': end_date.isoformat()
        }
    
    if category:
        query['category'] = category
    
    # Get all tickets matching filters
    tickets = await db.tickets.find(query, {"_id": 0}).to_list(10000)
    
    # Permintaan types
    permintaan_types = ['INTEGRASI', 'PUSH BIMA', 'RECONFIG', 'REPLACE ONT', 'TROUBLESHOOT']
    
    # Group by agent
    agent_data = {}
    
    for ticket in tickets:
        agent_name = ticket.get('assigned_agent_name')
        if not agent_name:
            continue
        
        permintaan = ticket.get('permintaan', '').upper()
        
        if agent_name not in agent_data:
            agent_data[agent_name] = {
                'agent': agent_name,
                'INTEGRASI': 0,
                'PUSH BIMA': 0,
                'RECONFIG': 0,
                'REPLACE ONT': 0,
                'TROUBLESHOOT': 0,
                'total': 0
            }
        
        # Count by permintaan type
        if permintaan in permintaan_types:
            agent_data[agent_name][permintaan] += 1
        
        agent_data[agent_name]['total'] += 1
    
    # Convert to list and sort by total descending
    result = list(agent_data.values())
    result.sort(key=lambda x: x['total'], reverse=True)
    
    # Calculate grand totals
    grand_total = {
        'agent': 'Grand Total',
        'INTEGRASI': sum(r['INTEGRASI'] for r in result),
        'PUSH BIMA': sum(r['PUSH BIMA'] for r in result),
        'RECONFIG': sum(r['RECONFIG'] for r in result),
        'REPLACE ONT': sum(r['REPLACE ONT'] for r in result),
        'TROUBLESHOOT': sum(r['TROUBLESHOOT'] for r in result),
        'total': sum(r['total'] for r in result)
    }
    
    return {
        "data": result,
        "grand_total": grand_total
    }

@api_router.get("/performance/by-product")
async def get_performance_by_product(
    year: Optional[int] = None,
    month: Optional[int] = None,
    agent_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get performance report grouped by product/category and permintaan type"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Build query for filtering tickets
    query = {}
    
    # Year and Month filter
    if year or month:
        if year and not month:
            start_date = datetime(year, 1, 1, tzinfo=timezone.utc)
            end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        elif month and not year:
            current_year = datetime.now(timezone.utc).year
            start_date = datetime(current_year, month, 1, tzinfo=timezone.utc)
            if month == 12:
                end_date = datetime(current_year + 1, 1, 1, tzinfo=timezone.utc)
            else:
                end_date = datetime(current_year, month + 1, 1, tzinfo=timezone.utc)
        else:
            start_date = datetime(year, month, 1, tzinfo=timezone.utc)
            if month == 12:
                end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
            else:
                end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)
        
        query['created_at'] = {
            '$gte': start_date.isoformat(),
            '$lt': end_date.isoformat()
        }
    
    if agent_id:
        query['assigned_agent'] = agent_id
    
    # Get all tickets matching filters
    tickets = await db.tickets.find(query, {"_id": 0}).to_list(10000)
    
    # Permintaan types
    permintaan_types = ['INTEGRASI', 'PUSH BIMA', 'RECONFIG', 'REPLACE ONT', 'TROUBLESHOOT']
    
    # Define product order 
    product_order = [
        'ASTINET', 'BITSTREAM', 'HSI Indibiz', 'IP TRANSIT', 'IPTV',
        'Technical Support', 'METRO-E', 'SIP TRUNK', 'VOICE', 'VPN IP',
        'WMS Reguler', 'WMS Lite'
    ]
    
    # Group by product/category
    product_data = {}
    
    for ticket in tickets:
        category = ticket.get('category', 'Unknown')
        permintaan = ticket.get('permintaan', '').upper()
        
        if category not in product_data:
            product_data[category] = {
                'product': category,
                'INTEGRASI': 0,
                'PUSH BIMA': 0,
                'RECONFIG': 0,
                'REPLACE ONT': 0,
                'TROUBLESHOOT': 0,
                'total': 0
            }
        
        # Count by permintaan type
        if permintaan in permintaan_types:
            product_data[category][permintaan] += 1
        
        product_data[category]['total'] += 1
    
    # Convert to list and sort by predefined order
    result = []
    for product in product_order:
        if product in product_data:
            result.append(product_data[product])
    
    # Add any other products not in predefined list
    for product, data in product_data.items():
        if product not in product_order:
            result.append(data)
    
    # Calculate grand totals
    grand_total = {
        'product': 'Grand Total',
        'INTEGRASI': sum(r['INTEGRASI'] for r in result),
        'PUSH BIMA': sum(r['PUSH BIMA'] for r in result),
        'RECONFIG': sum(r['RECONFIG'] for r in result),
        'REPLACE ONT': sum(r['REPLACE ONT'] for r in result),
        'TROUBLESHOOT': sum(r['TROUBLESHOOT'] for r in result),
        'total': sum(r['total'] for r in result)
    }
    
    return {
        "data": result,
        "grand_total": grand_total
    }

class TelegramWebhookRequest(BaseModel):
    user_telegram_id: str
    user_telegram_name: str
    category: str
    description: str
    permintaan: Optional[str] = None
    tipe_transaksi: Optional[str] = None
    order_number: Optional[str] = None
    wonum: Optional[str] = None
    tiket_fo: Optional[str] = None
    nd_internet_voice: Optional[str] = None
    password: Optional[str] = None
    paket_inet: Optional[str] = None
    sn_lama: Optional[str] = None
    sn_baru: Optional[str] = None
    sn_ap: Optional[str] = None
    mac_ap: Optional[str] = None
    ssid: Optional[str] = None
    tipe_ont: Optional[str] = None
    gpon_slot_port: Optional[str] = None
    vlan: Optional[str] = None
    svlan: Optional[str] = None
    cvlan: Optional[str] = None
    task_bima: Optional[str] = None
    ownergroup: Optional[str] = None
    keterangan_lainnya: Optional[str] = None

@api_router.get("/tickets/years")
async def get_ticket_years(current_user: User = Depends(get_current_user)):
    """Get available years for filter"""
    pipeline = [
        {"$project": {"year": {"$year": "$created_at"}}},
        {"$group": {"_id": "$year"}},
        {"$sort": {"_id": -1}}
    ]
    years = await db.tickets.aggregate(pipeline).to_list(None)
    return {"years": [y["_id"] for y in years if y["_id"] is not None]}

@api_router.get("/tickets/categories")
async def get_ticket_categories(current_user: User = Depends(get_current_user)):
    """Get available categories for filter"""
    categories = await db.tickets.distinct("category")
    return {"categories": sorted([c for c in categories if c])}

@api_router.post("/webhook/telegram", response_model=Ticket)
async def telegram_webhook(request: TelegramWebhookRequest):
    """Endpoint for Telegram Bot to create tickets (No Auth required for now)"""
    
    # Generate Ticket Number
    # Format: INC${MM}${DD}${YYYY}${HH}${mm}${ss}${randomText}
    # Example: INC111520251928405B6
    now = datetime.now()
    date_str = now.strftime("%m%d%Y%H%M%S")
    random_str = ''.join(random.choices(string.ascii_uppercase + string.digits, k=3))
    ticket_number = f"INC{date_str}{random_str}"
    
    # Create Ticket object
    ticket_dict = request.model_dump()
    ticket_dict['ticket_number'] = ticket_number
    ticket_dict['status'] = 'open'
    ticket_dict['created_at'] = datetime.now(timezone.utc)
    ticket_dict['id'] = str(uuid.uuid4())
    ticket_dict['assigned_agent'] = None
    
    # Insert into DB
    await db.tickets.insert_one(ticket_dict)
    
    # Invalidate cache
    await redis_client.delete("dashboard:admin:stats:v2")
    
    # Return as Ticket model
    return Ticket(**ticket_dict)

# Include the router in the main app
app.include_router(api_router)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Seed data on startup (for demo purposes)
@app.on_event("startup")
async def seed_data():
    # Check if admin exists
    admin = await db.users.find_one({"username": "admin"})
    if not admin:
        admin_user = User(
            username="admin",
            role="admin",
            status="approved"
        )
        admin_dict = admin_user.model_dump()
        admin_dict['created_at'] = admin_dict['created_at'].isoformat()
        admin_dict['password_hash'] = get_password_hash("admin123")
        await db.users.insert_one(admin_dict)
        logger.info("Admin user created")
    
    # Create sample agents
    for i in range(1, 4):
        agent_username = f"agent{i}"
        agent = await db.users.find_one({"username": agent_username})
        if not agent:
            agent_user = User(
                username=agent_username,
                role="agent",
                status="approved"
            )
            agent_dict = agent_user.model_dump()
            agent_dict['created_at'] = agent_dict['created_at'].isoformat()
            agent_dict['password_hash'] = get_password_hash("admin123")
            await db.users.insert_one(agent_dict)
            logger.info(f"Agent {agent_username} created")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
