from pydantic import BaseModel
from typing import List

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
