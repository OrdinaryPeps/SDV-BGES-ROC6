from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, timezone
import json
from ..core.database import get_db
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

def filter_tickets(tickets, year, month, category, agent_id):
    filtered = []
    for t in tickets:
        dt = parse_datetime(t.get('created_at'))
        if not dt: continue
        
        if year and year != 'all' and str(dt.year) != str(year): continue
        if month and month != 'all' and str(dt.month) != str(month): continue
        if category and category != 'all' and t.get('category') != category: continue
        if agent_id and agent_id != 'all' and t.get('assigned_agent') != agent_id: continue
        
        filtered.append(t)
    return filtered

@router.get("/table-data")
async def get_performance_table_data(
    year: Optional[str] = None,
    month: Optional[str] = None,
    category: Optional[str] = None,
    agent_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    tickets = await db.tickets.find({}).to_list(10000)
    filtered_tickets = filter_tickets(tickets, year, month, category, agent_id)
    
    agent_stats = {}
    
    for t in filtered_tickets:
        agent_name = t.get('assigned_agent_name', 'Unassigned')
        if not t.get('assigned_agent'):
            agent_name = 'Unassigned'
            
        if agent_name not in agent_stats:
            agent_stats[agent_name] = {
                "agent": agent_name,
                "total": 0,
                "completed": 0,
                "in_progress": 0,
                "pending": 0,
                "under_1hr": 0,
                "between_1_2hr": 0,
                "between_2_3hr": 0,
                "over_3hr": 0
            }
            
        stats = agent_stats[agent_name]
        stats["total"] += 1
        
        status = t.get('status')
        if status == 'completed':
            stats["completed"] += 1
            
            created = parse_datetime(t.get('created_at'))
            completed = parse_datetime(t.get('completed_at'))
            
            if created and completed:
                duration_hours = (completed - created).total_seconds() / 3600
                if duration_hours < 1:
                    stats["under_1hr"] += 1
                elif 1 <= duration_hours < 2:
                    stats["between_1_2hr"] += 1
                elif 2 <= duration_hours <= 3:
                    stats["between_2_3hr"] += 1
                else:
                    stats["over_3hr"] += 1
                    
        elif status == 'in_progress':
            stats["in_progress"] += 1
        elif status == 'pending':
            stats["pending"] += 1

    # Calculate rates and summary
    data = []
    summary = {
        "completion_rate": 0,
        "under_1hr": 0,
        "between_1_2hr": 0,
        "between_2_3hr": 0,
        "over_3hr": 0,
        "pending": 0,
        "in_progress": 0,
        "completed": 0,
        "total": 0
    }
    
    for stats in agent_stats.values():
        if stats["total"] > 0:
            stats["completion_rate"] = round((stats["completed"] / stats["total"]) * 100, 1)
        else:
            stats["completion_rate"] = 0
        data.append(stats)
        
        summary["total"] += stats["total"]
        summary["completed"] += stats["completed"]
        summary["in_progress"] += stats["in_progress"]
        summary["pending"] += stats["pending"]
        summary["under_1hr"] += stats["under_1hr"]
        summary["between_1_2hr"] += stats.get("between_1_2hr", 0)
        summary["between_2_3hr"] += stats["between_2_3hr"]
        summary["over_3hr"] += stats["over_3hr"]
        
    if summary["total"] > 0:
        summary["completion_rate"] = round((summary["completed"] / summary["total"]) * 100, 1)
        
    return {"data": data, "summary": summary}

@router.get("/by-agent")
async def get_performance_by_agent(
    year: Optional[str] = None,
    month: Optional[str] = None,
    category: Optional[str] = None,
    agent_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get all tickets, not just completed ones, to show workload
    tickets = await db.tickets.find({}).to_list(10000)
    filtered_tickets = filter_tickets(tickets, year, month, category, agent_id)
    
    agent_stats = {}
    grand_total = {
        "INTEGRASI": 0, "PUSH BIMA": 0, "RECONFIG": 0, 
        "REPLACE ONT": 0, "TROUBLESHOOT": 0, "total": 0
    }
    
    for t in filtered_tickets:
        agent = t.get('assigned_agent_name', 'Unassigned')
        if not t.get('assigned_agent'):
            agent = 'Unassigned'
            
        if agent not in agent_stats:
            agent_stats[agent] = {
                "agent": agent, 
                "INTEGRASI": 0, "PUSH BIMA": 0, "RECONFIG": 0, 
                "REPLACE ONT": 0, "TROUBLESHOOT": 0, "total": 0
            }
        
        permintaan = (t.get('permintaan') or '').upper()
        if permintaan in agent_stats[agent]:
            agent_stats[agent][permintaan] += 1
            agent_stats[agent]["total"] += 1
            
            grand_total[permintaan] += 1
            grand_total["total"] += 1

    result = list(agent_stats.values())
    return {"data": sorted(result, key=lambda x: x['total'], reverse=True), "grand_total": grand_total}

@router.get("/by-product")
async def get_performance_by_product(
    year: Optional[str] = None,
    month: Optional[str] = None,
    category: Optional[str] = None,
    agent_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    tickets = await db.tickets.find({}).to_list(10000)
    filtered_tickets = filter_tickets(tickets, year, month, category, agent_id)
    
    product_stats = {}
    grand_total = {
        "INTEGRASI": 0, "PUSH BIMA": 0, "RECONFIG": 0, 
        "REPLACE ONT": 0, "TROUBLESHOOT": 0, "total": 0
    }
    
    for t in filtered_tickets:
        product = t.get('category', 'Unknown')
        if product not in product_stats:
            product_stats[product] = {
                "product": product, 
                "INTEGRASI": 0, "PUSH BIMA": 0, "RECONFIG": 0, 
                "REPLACE ONT": 0, "TROUBLESHOOT": 0, "total": 0
            }
            
        permintaan = (t.get('permintaan') or '').upper()
        if permintaan in product_stats[product]:
            product_stats[product][permintaan] += 1
            product_stats[product]["total"] += 1
            
            grand_total[permintaan] += 1
            grand_total["total"] += 1
            
    result = list(product_stats.values())
    return {"data": sorted(result, key=lambda x: x['total'], reverse=True), "grand_total": grand_total}
