import asyncio
import sys
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.core.security import verify_password, get_password_hash
from app.models.user import User

# Logging helper
LOG_FILE = "diag_result.txt"
def log(msg):
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

# Clear log file
with open(LOG_FILE, "w", encoding="utf-8") as f:
    f.write("--- DIAGNOSTIC START ---\n")

async def check_mongo():
    log("\n--- 1. CHECKING MONGODB ---")
    try:
        client = AsyncIOMotorClient(settings.MONGO_URL)
        # Force connection
        await client.admin.command('ping')
        log(f"[OK] MongoDB connected at {settings.MONGO_URL}")
        return client
    except Exception as e:
        log(f"[FAIL] MongoDB Connection Failed: {e}")
        return None

async def check_admin(client):
    log("\n--- 2. CHECKING ADMIN USER ---")
    if not client:
        log("Skipping (No DB)")
        return

    db = client[settings.DB_NAME]
    user = await db.users.find_one({"username": "admin"})
    
    if not user:
        log("[FAIL] Admin user NOT found")
        return

    log("[OK] Admin user found")
    log(f"   - ID: {user.get('id')} ({'[OK]' if user.get('id') else '[FAIL] MISSING'})")
    log(f"   - Role: {user.get('role')} ({'[OK]' if user.get('role') == 'admin' else '[FAIL] WRONG'})")
    log(f"   - Status: {user.get('status')} ({'[OK]' if user.get('status') == 'approved' else '[FAIL] WRONG'})")
    log(f"   - Password Hash: {'[OK] Present' if user.get('password_hash') else '[FAIL] MISSING'}")
    
    return user

def check_crypto(user):
    log("\n--- 3. CHECKING CRYPTO (BCRYPT) ---")
    try:
        import bcrypt
        log(f"[OK] bcrypt imported (Version: {bcrypt.__version__})")
    except ImportError:
        log("[FAIL] bcrypt NOT installed")
        return

    try:
        from passlib.context import CryptContext
        log("[OK] passlib imported")
    except ImportError:
        log("[FAIL] passlib NOT installed")
        return

    if user and 'password_hash' in user:
        try:
            is_valid = verify_password("admin123", user['password_hash'])
            log(f"[OK] Password verification test: {'SUCCESS' if is_valid else 'FAILED'}")
        except Exception as e:
            log(f"[FAIL] Password verification CRASHED: {e}")
    else:
        log("Skipping verification test (no user)")

def check_jwt(user):
    log("\n--- 4. CHECKING JWT GENERATION ---")
    try:
        from app.core.security import create_access_token
        from datetime import timedelta
        
        if not user:
            log("Skipping JWT test (no user)")
            return
            
        subject = {"sub": user['username'], "role": user['role'], "id": user['id']}
        token = create_access_token(subject, timedelta(minutes=60))
        log(f"[OK] JWT Token generated: {token[:20]}...")
    except Exception as e:
        log(f"[FAIL] JWT Generation CRASHED: {e}")
        import traceback
        log(traceback.format_exc())

def check_user_model(user):
    log("\n--- 5. CHECKING USER MODEL VALIDATION ---")
    try:
        from app.models.user import User
        if not user:
            log("Skipping User model test (no user)")
            return
            
        log(f"User data keys: {list(user.keys())}")
        log(f"User created_at type: {type(user.get('created_at'))}")
        
        user_obj = User(**user)
        log(f"[OK] User model instantiated: {user_obj.username}")
    except Exception as e:
        log(f"[FAIL] User model validation CRASHED: {e}")
        import traceback
        log(traceback.format_exc())

def check_api():
    log("\n--- 6. CHECKING API ENDPOINT ---")
    url = "http://localhost:8003/api/auth/login"
    try:
        response = requests.post(url, json={"username": "admin", "password": "admin123"})
        log(f"API Status Code: {response.status_code}")
        if response.status_code == 200:
            log("[OK] Login Successful via API")
        else:
            log(f"[FAIL] Login Failed via API. Response: {response.text}")
            log(f"   Headers: {response.headers}")
    except requests.exceptions.ConnectionError:
        log("[FAIL] Could not connect to API (Server not running?)")
    except Exception as e:
        log(f"[FAIL] API Check Error: {e}")

def check_middleware():
    log("\n--- 7. CHECKING MIDDLEWARE ---")
    try:
        from app.main import app
        log(f"Middleware count: {len(app.user_middleware)}")
        for m in app.user_middleware:
            log(f" - {m.cls.__name__}")
    except Exception as e:
        log(f"[FAIL] Middleware check failed: {e}")

async def main():
    client = await check_mongo()
    user = await check_admin(client)
    check_crypto(user)
    check_jwt(user)
    check_user_model(user)
    check_middleware()
    check_api()

if __name__ == "__main__":
    asyncio.run(main())
