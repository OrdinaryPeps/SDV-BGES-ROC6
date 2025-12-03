from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
import uuid

class CommentCreate(BaseModel):
    comment: str

class CommentCreateBot(BaseModel):
    ticket_number: str
    user_telegram_id: str
    user_telegram_name: str
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
    read_by_agent: bool = False  # Track if agent has read this comment
