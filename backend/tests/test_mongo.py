import pytest
from app.core.database import get_db

@pytest.mark.asyncio
async def test_mongo_mock(authorized_client):
    try:
        response = await authorized_client.get("/api/tickets/")
        print(f"\nSTATUS: {response.status_code}")
        print(f"BODY: {response.text}")
        assert response.status_code == 200
    except Exception as e:
        print(f"\n\nERROR: {e}\n\n")
        raise e
