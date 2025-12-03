import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_ticket_lifecycle(authorized_client: AsyncClient):
    # 1. Create a Ticket (simulating Bot/User via API)
    # Note: Ticket creation usually requires auth if not public. 
    # Our authorized_client simulates an admin, but let's assume it can create tickets too.
    ticket_data = {
        "user_telegram_id": "123456789",
        "user_telegram_name": "@testuser",
        "category": "HSI INDIBIZ",
        "description": "Test ticket description",
        "permintaan": "TROUBLESHOOT",
        "tipe_transaksi": "AO",
        "order_number": "SC123",
        "wonum": "WO123",
        "nd_internet_voice": "123456",
        "keterangan_lainnya": "Test note"
    }
    
    response = await authorized_client.post("/api/tickets/", json=ticket_data)
    assert response.status_code == 200
    ticket = response.json()
    assert ticket["ticket_number"] is not None
    assert ticket["status"] == "open"
    ticket_id = ticket["id"]
    
    # 2. Verify Ticket Created
    assert ticket["status"] == "open"
    
    # 3. Get Ticket Details
    response = await authorized_client.get(f"/api/tickets/{ticket_id}")
    assert response.status_code == 200
    assert response.json()["id"] == ticket_id

    # 4. Update Ticket (Assign Agent)
    update_data = {
        "assigned_agent": "test_agent_id",
        "assigned_agent_name": "@agent",
        "status": "in_progress"
    }
    response = await authorized_client.put(f"/api/tickets/{ticket_id}", json=update_data)
    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"
    assert response.json()["assigned_agent"] == "test_agent_id"

    # 5. Complete Ticket
    complete_data = {
        "status": "completed"
    }
    response = await authorized_client.put(f"/api/tickets/{ticket_id}", json=complete_data)
    assert response.status_code == 200
    assert response.json()["status"] == "completed"
    assert response.json()["completed_at"] is not None

@pytest.mark.asyncio
async def test_root(async_client: AsyncClient):
    response = await async_client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to BotSDV Backend API"}
