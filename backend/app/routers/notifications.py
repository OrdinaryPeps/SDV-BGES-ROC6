from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import List
import json
import asyncio
from ..core.deps import get_current_user
from ..core.logging import logger

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.user_connections: dict = {}  # {user_id: websocket}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.user_connections[user_id] = websocket
        logger.info(f"WebSocket connected: user {user_id}")

    def disconnect(self, websocket: WebSocket, user_id: str):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if user_id in self.user_connections:
            del self.user_connections[user_id]
        logger.info(f"WebSocket disconnected: user {user_id}")

    async def send_personal_message(self, message: dict, user_id: str):
        """Send message to specific user"""
        if user_id in self.user_connections:
            try:
                await self.user_connections[user_id].send_json(message)
            except Exception as e:
                logger.error(f"Error sending message to {user_id}: {e}")

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting: {e}")
                disconnected.append(connection)
        
        # Remove disconnected
        for conn in disconnected:
            if conn in self.active_connections:
                self.active_connections.remove(conn)

manager = ConnectionManager()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    """
    WebSocket endpoint for real-time notifications
    Connect with: ws://localhost:8001/api/notifications/ws?token=YOUR_JWT_TOKEN
    """
    user_id = None
    try:
        # Simple token validation (in production, decode JWT properly)
        # For now, we'll accept any connection and use a temp ID
        user_id = token if token else str(id(websocket))
        
        await manager.connect(websocket, user_id)
        
        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Wait for any message from client (ping/pong)
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_text("pong")
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"WebSocket error: {e}")
                break
                
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
    finally:
        if user_id:
            manager.disconnect(websocket, user_id)

# Helper function to notify clients (called from other routers)
async def notify_new_ticket(ticket_data: dict):
    """Notify all agents about new ticket"""
    await manager.broadcast({
        "type": "new_ticket",
        "data": ticket_data
    })

async def notify_new_reply(ticket_id: str, ticket_number: str, user_name: str):
    """Notify agents about new user reply"""
    await manager.broadcast({
        "type": "new_reply",
        "data": {
            "ticket_id": ticket_id,
            "ticket_number": ticket_number,
            "user_name": user_name
        }
    })
