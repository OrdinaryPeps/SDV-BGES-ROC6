from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
import re
from ..core.database import get_db
from ..core.deps import get_current_user, is_admin_role, ADMIN_ROLES
from ..core.security import get_password_hash
from ..models.user import User
from ..core.logging import logger

router = APIRouter()

class ResetPasswordRequest(BaseModel):
    new_password: str

class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    username: Optional[str] = None

@router.get("/pending", response_model=List[User])
async def get_pending_users(current_user: User = Depends(get_current_user), db = Depends(get_db)):
    if not is_admin_role(current_user.role):
        raise HTTPException(status_code=403, detail="Hak akses admin diperlukan")
    
    users = await db.users.find({"status": "pending"}, {"_id": 0}).to_list(1000)
    return [User(**u) for u in users]

@router.get("/agents", response_model=List[User])
async def get_agents(current_user: User = Depends(get_current_user), db = Depends(get_db)):
    # Allow agents to see other agents for assignment if needed, or just admin
    # For now, let's allow both
    users = await db.users.find({"role": "agent", "status": "approved"}, {"_id": 0}).to_list(1000)
    return [User(**u) for u in users]

@router.get("/admins", response_model=List[User])
async def get_admins(current_user: User = Depends(get_current_user), db = Depends(get_db)):
    if not is_admin_role(current_user.role):
        raise HTTPException(status_code=403, detail="Hak akses admin diperlukan")
    
    # Get all admin-level users (admin + developer)
    query = {"role": {"$in": ADMIN_ROLES}, "status": "approved"}
    
    # If NOT developer role, exclude developer users from the list
    if current_user.role != "developer":
        query["role"] = "admin"  # Admin only sees other admins, not developer
    
    users = await db.users.find(query, {"_id": 0}).to_list(1000)
    return [User(**u) for u in users]


@router.put("/{user_id}/approve")
async def approve_user(
    user_id: str, 
    role: str = "agent", # Default to agent if not specified
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    if not is_admin_role(current_user.role):
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
    if not is_admin_role(current_user.role):
        raise HTTPException(status_code=403, detail="Hak akses admin diperlukan")
    
    result = await db.users.delete_one({"id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    
    return {"message": "User deleted"}

@router.put("/{user_id}/reset-password")
async def reset_password(user_id: str, request: ResetPasswordRequest, current_user: User = Depends(get_current_user), db = Depends(get_db)):
    if not is_admin_role(current_user.role):
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

@router.put("/update-profile")
async def update_profile(
    request: UpdateProfileRequest, 
    current_user: User = Depends(get_current_user), 
    db = Depends(get_db)
):
    update_data = {}
    
    # Validate and update full_name
    if request.full_name is not None:
        if len(request.full_name.strip()) < 2:
            raise HTTPException(status_code=400, detail="Nama minimal 2 karakter")
        update_data["full_name"] = request.full_name.strip()
    
    # Validate and update username
    if request.username is not None:
        username = request.username.strip()
        
        # Validate username format
        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            raise HTTPException(status_code=400, detail="Username hanya boleh huruf, angka, dan underscore (_)")
        
        if len(username) < 3:
            raise HTTPException(status_code=400, detail="Username minimal 3 karakter")
        
        # Check if username already exists (exclude current user)
        existing = await db.users.find_one({"username": username, "id": {"$ne": current_user.id}})
        if existing:
            raise HTTPException(status_code=400, detail="Username sudah digunakan")
        
        update_data["username"] = username
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Tidak ada data yang diubah")
    
    result = await db.users.update_one(
        {"id": current_user.id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Gagal memperbarui profil")
    
    # Get updated user data
    updated_user = await db.users.find_one({"id": current_user.id}, {"_id": 0, "password_hash": 0})
    logger.info(f"User {current_user.id} updated profile: {update_data.keys()}")
    
    return {"message": "Profil berhasil diperbarui", "user": updated_user}
