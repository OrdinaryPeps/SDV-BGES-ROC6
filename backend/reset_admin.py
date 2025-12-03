import asyncio
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.core.security import get_password_hash

async def reset_admin():
    # Use default settings
    mongo_url = settings.MONGO_URL
    print(f"Connecting to MongoDB at {mongo_url}...")
    client = AsyncIOMotorClient(mongo_url)
    db = client[settings.DB_NAME]
    
    username = "admin"
    password = "admin123"
    hashed_password = get_password_hash(password)
    
    # Verify locally before saving
    from app.core.security import verify_password
    print(f"Local Verification (Pre-save): {verify_password(password, hashed_password)}")

    user = await db.users.find_one({"username": username})
    
    if user:
        print(f"User '{username}' found. Updating password...")
        # Update password and ensure fields
        update_data = {
            "password_hash": hashed_password,
            "role": "admin",
            "status": "approved"
        }
        if "id" not in user:
            update_data["id"] = str(uuid.uuid4())
            
        await db.users.update_one(
            {"username": username},
            {"$set": update_data}
        )
        print("Password updated successfully.")
        
    else:
        print(f"User '{username}' not found. Creating new admin user...")
        from app.models.user import User
        
        # Create using Pydantic model to ensure all defaults (like id, created_at) are set
        new_user_model = User(
            username=username,
            password_hash=hashed_password,
            role="admin",
            status="approved",
            full_name="Administrator"
        )
        
        # Convert to dict for MongoDB
        new_user_dict = new_user_model.model_dump()
        
        await db.users.insert_one(new_user_dict)
        print("Admin user created successfully.")

if __name__ == "__main__":
    asyncio.run(reset_admin())
