from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import json
from ..core.database import get_db, get_redis
from ..core.deps import get_current_user
from ..models.user import User
from ..core.logging import logger

router = APIRouter()

def parse_datetime(dt):
    if dt is None:
        return None
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt

@router.get("/admin-dashboard")
async def get_admin_dashboard(current_user: User = Depends(get_current_user), db = Depends(get_db), redis = Depends(get_redis)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Hak akses admin diperlukan")
    
    cache_key = "dashboard:admin:stats:v2"
    cached_stats = await redis.get(cache_key)
    if cached_stats:
        return json.loads(cached_stats)
    
    all_tickets = await db.tickets.find({}, {"_id": 0}).to_list(10000)
    
    today = datetime.now(timezone.utc).date()
    today_tickets = []
    for t in all_tickets:
        dt = parse_datetime(t.get('created_at'))
        if dt:
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if dt.date() == today:
                today_tickets.append(t)
    
    this_month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_tickets = []
    for t in all_tickets:
        dt = parse_datetime(t.get('created_at'))
        if dt:
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if dt >= this_month_start:
                month_tickets.append(t)
    
    today_stats = {
        "received": len(today_tickets),
        "completed": sum(1 for t in today_tickets if t['status'] == 'completed'),
        "in_progress": sum(1 for t in today_tickets if t['status'] == 'in_progress'),
        "open": sum(1 for t in all_tickets if t['status'] == 'open')
    }
    
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
    
    month_agents = set(t.get('assigned_agent') for t in month_tickets if t.get('assigned_agent'))
    
    month_stats = {
        "received": len(month_tickets),
        "completed": len(month_completed),
        "avg_time": sum(month_times) / len(month_times) if month_times else 0,
        "active_agents": len(month_agents)
    }
    
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
    
    await redis.setex(cache_key, 300, json.dumps(result))
    
    return result

@router.get("/agent-dashboard/{agent_id}")
async def get_agent_dashboard(agent_id: str, current_user: User = Depends(get_current_user), db = Depends(get_db), redis = Depends(get_redis)):
    if current_user.role == "agent" and current_user.id != agent_id:
        raise HTTPException(status_code=403, detail="Hak akses admin/agent diperlukan")
    
    cache_key = f"dashboard:agent:{agent_id}:stats:v2"
    cached_stats = await redis.get(cache_key)
    if cached_stats:
        return json.loads(cached_stats)
    
    all_tickets = await db.tickets.find({"assigned_agent": agent_id}, {"_id": 0}).to_list(10000)
    
    today = datetime.now(timezone.utc).date()
    today_tickets = []
    for t in all_tickets:
        dt = parse_datetime(t.get('created_at'))
        if dt and dt.date() == today:
            today_tickets.append(t)
    
    this_month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_tickets = []
    for t in all_tickets:
        dt = parse_datetime(t.get('created_at'))
        if dt and dt >= this_month_start:
            month_tickets.append(t)
            
    today_stats = {
        "received": len(today_tickets),
        "completed": sum(1 for t in today_tickets if t['status'] == 'completed'),
        "in_progress": sum(1 for t in today_tickets if t['status'] == 'in_progress'),
        "pending": sum(1 for t in today_tickets if t['status'] == 'pending')
    }
    
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
    
    await redis.setex(cache_key, 300, json.dumps(result))
    
    return result

@router.get("/performance/by-agent")
async def get_performance_by_agent(current_user: User = Depends(get_current_user), db = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    tickets = await db.tickets.find({"status": "completed"}).to_list(10000)
    agent_stats = {}
    
    for t in tickets:
        agent = t.get('assigned_agent_name', 'Unknown')
        if agent not in agent_stats:
            agent_stats[agent] = {"name": agent, "completed": 0, "total_time": 0}
        
        agent_stats[agent]["completed"] += 1
        
        created = parse_datetime(t.get('created_at'))
        completed = parse_datetime(t.get('completed_at'))
        if created and completed:
             if created.tzinfo is None: created = created.replace(tzinfo=timezone.utc)
             if completed.tzinfo is None: completed = completed.replace(tzinfo=timezone.utc)
             duration = (completed - created).total_seconds() / 3600
             agent_stats[agent]["total_time"] += duration

    result = []
    for agent, stats in agent_stats.items():
        avg_time = stats["total_time"] / stats["completed"] if stats["completed"] > 0 else 0
        result.append({
            "name": agent,
            "tickets": stats["completed"],
            "avg_time": round(avg_time, 1)
        })
    
    return sorted(result, key=lambda x: x['tickets'], reverse=True)

@router.get("/performance/by-product")
async def get_performance_by_product(current_user: User = Depends(get_current_user), db = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    tickets = await db.tickets.find({}).to_list(10000)
    product_stats = {}
    
    for t in tickets:
        product = t.get('category', 'Unknown')
        if product not in product_stats:
            product_stats[product] = {"name": product, "total": 0, "completed": 0}
            
        product_stats[product]["total"] += 1
        if t.get('status') == 'completed':
            product_stats[product]["completed"] += 1
            
    result = []
    for product, stats in product_stats.items():
        result.append({
            "name": product,
            "total": stats["total"],
            "completed": stats["completed"]
        })
        
    return sorted(result, key=lambda x: x['total'], reverse=True)

@router.get("/agent/{agent_id}")
async def get_agent_performance_stats(agent_id: str, current_user: User = Depends(get_current_user), db = Depends(get_db)):
    """Endpoint specifically for AgentPerformancePage.js"""
    if current_user.role == "agent" and current_user.id != agent_id:
        raise HTTPException(status_code=403, detail="Hak akses admin/agent diperlukan")
        
    all_tickets = await db.tickets.find({"assigned_agent": agent_id}, {"_id": 0}).to_list(10000)
    
    completed_tickets = [t for t in all_tickets if t['status'] == 'completed']
    in_progress = sum(1 for t in all_tickets if t['status'] == 'in_progress')
    
    total_time_hours = 0
    for t in completed_tickets:
        created = parse_datetime(t.get('created_at'))
        completed = parse_datetime(t.get('completed_at'))
        if created and completed:
            total_time_hours += (completed - created).total_seconds() / 3600
            
    avg_time = total_time_hours / len(completed_tickets) if completed_tickets else 0
    
    # Calculate rating (simple mock logic or based on completion rate/time)
    completion_rate = (len(completed_tickets) / len(all_tickets)) * 100 if all_tickets else 0
    rating = min(5.0, (completion_rate / 20)) # Scale 0-100% to 0-5
    
    return {
        "total_tickets": len(all_tickets),
        "completed_tickets": len(completed_tickets),
        "in_progress_tickets": in_progress,
        "avg_completion_time_hours": avg_time,
        "rating": rating
    }
