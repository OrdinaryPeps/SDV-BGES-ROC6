import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI
from app.main import app
from app.core.deps import get_current_user
from app.models.user import User

@pytest_asyncio.fixture
async def authorized_client(async_client: AsyncClient, app: FastAPI):
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
    
    app.dependency_overrides[get_current_user] = mock_get_current_user
    
    # Mock Redis
    from app.core.database import get_redis
    from unittest.mock import AsyncMock
    
    async def mock_get_redis():
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None
        mock_redis.setex.return_value = None
        mock_redis.delete.return_value = None
        return mock_redis
        
    app.dependency_overrides[get_redis] = mock_get_redis
    
    # Mock MongoDB
    from app.core.database import get_db
    from mongomock_motor import AsyncMongoMockClient
    
    async def mock_get_db():
        client = AsyncMongoMockClient()
        return client["test_db"]
        
    app.dependency_overrides[get_db] = mock_get_db
    
    yield async_client
    
    app.dependency_overrides = {}

@pytest_asyncio.fixture
async def async_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
