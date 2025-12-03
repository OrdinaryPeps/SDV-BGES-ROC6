from fastapi import APIRouter, HTTPException, Depends
from typing import List
from pydantic import BaseModel
from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.security import get_password_hash
from ..models.user import User
from ..core.logging import logger

router = APIRouter()

class ResetPasswordRequest(BaseModel):
    new_password: str

@router.get("/pending", response_model=List[User])
async def get_pending_users(current_user: User = Depends(get_current_user), db = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Hak akses admin diperlukan")
    
    users = await db.users.find({"status": "pending"}, {"_id": 0}).to_list(1000)
    return [User(**u) for u in users]

@router.get("/agents", response_model=List[User])
async def get_agents(current_user: User = Depends(get_current_user), db = Depends(get_db)):
    # Allow agents to see other agents for assignment if needed, or just admin
    # For now, let's allow both
    users = await db.users.find({"role": "agent", "status": "approved"}, {"_id": 0}).to_list(1000)
    return [User(**u) for u in users]

@router.put("/{user_id}/approve")
async def approve_user(
    user_id: str, 
    role: str = "agent", # Default to agent if not specified
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Hak akses admin diperlukan")
    
    if role not in ["agent", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"status": "approved", "role": role}}
    )
    
    if result.modified_count == 0:
        logger.warning(f"Failed to approve user {user_id}: User not found")
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    
    logger.info(f"User {user_id} approved as {role} by {current_user.username}")
    return {"message": f"User approved as {role}"}

@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user), db = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Hak akses admin diperlukan")
    
    result = await db.users.delete_one({"id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    
    return {"message": "User deleted"}

@router.put("/{user_id}/reset-password")
async def reset_password(user_id: str, request: ResetPasswordRequest, current_user: User = Depends(get_current_user), db = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Hak akses admin diperlukan")
    
    hashed_password = get_password_hash(request.new_password)
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": hashed_password}}
    )
    
    if result.modified_count == 0:
        # Check if user exists but password is same (not modified)
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User tidak ditemukan")
    
    return {"message": "Password berhasil direset"}
