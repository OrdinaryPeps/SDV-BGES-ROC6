from fastapi import APIRouter, HTTPException, status, Depends, Request
from datetime import timedelta
from slowapi import Limiter
from slowapi.util import get_remote_address
from ..core.security import create_access_token, get_password_hash, verify_password
from ..core.config import settings
from ..core.database import get_db
from ..models.user import User, UserCreate, UserLogin
from ..core.logging import logger

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

@router.post("/register", response_model=User)
@limiter.limit("3/minute")  # Prevent spam registration
async def register(request: Request, user_data: UserCreate, db = Depends(get_db)):
    # Check if username exists
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username sudah terdaftar")
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    user = User(
        username=user_data.username,
        full_name=user_data.full_name,
        role=user_data.role,
        status="pending" # All new registrations must be approved by admin
    )
    
    user_dict = user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    user_dict['password_hash'] = hashed_password
    
    await db.users.insert_one(user_dict)
    return user

@router.post("/login")
@limiter.limit("5/minute")  # Prevent brute force attacks
async def login(request: Request, form_data: UserLogin, db = Depends(get_db)):
    logger.info(f"Login attempt for user: {form_data.username}")
    user = await db.users.find_one({"username": form_data.username})

    if not user or not verify_password(form_data.password, user['password_hash']):
        logger.warning(f"Failed login attempt for user: {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Salah username atau password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if user['status'] != 'approved':
        raise HTTPException(status_code=400, detail="Akun belum disetujui")
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject={"sub": user['username'], "role": user['role'], "id": user['id']},
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer", "user": User(**user)}

