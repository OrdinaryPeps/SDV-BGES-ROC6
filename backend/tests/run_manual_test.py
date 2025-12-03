import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.deps import get_current_user
from app.core.database import get_db, get_redis
from app.models.user import User
from unittest.mock import AsyncMock, MagicMock

async def mock_get_current_user():
    return User(
        id="test_admin_id",
        username="admin",
        role="admin",
        full_name="Admin Test",
        status="approved",
        created_at="2023-01-01T00:00:00",
        password_hash="hash"
    )

async def mock_get_redis():
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.setex.return_value = None
    mock_redis.delete.return_value = None
    return mock_redis

async def mock_get_db():
    mock_db = MagicMock()
    
    # Mock tickets collection
    mock_tickets = MagicMock()
    mock_db.tickets = mock_tickets
    
    # Mock find().sort().to_list() chain
    mock_cursor = MagicMock()
    mock_cursor.sort.return_value = mock_cursor
    mock_cursor.to_list = AsyncMock(return_value=[])
    
    mock_tickets.find.return_value = mock_cursor
    
    # Mock find_one (awaitable)
    mock_tickets.find_one = AsyncMock(return_value=None)
    mock_tickets.insert_one = AsyncMock(return_value=None)
    mock_tickets.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
    mock_tickets.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))
    
    # Mock users collection
    mock_users = MagicMock()
    mock_db.users = mock_users
    mock_users.find_one = AsyncMock(return_value=None)
    mock_users.insert_one = AsyncMock(return_value=None)
    
    return mock_db

async def main():
    # Override dependencies
    app.dependency_overrides[get_current_user] = mock_get_current_user
    app.dependency_overrides[get_redis] = mock_get_redis
    app.dependency_overrides[get_db] = mock_get_db
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        print("Sending request...")
        try:
            response = await client.get("/api/tickets/")
            print(f"STATUS: {response.status_code}")
            print(f"BODY: {response.text}")
        except Exception as e:
            print(f"ERROR: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
