import sys
print(f"Python executable: {sys.executable}")
print("Importing passlib...")
try:
    from passlib.context import CryptContext
    print("passlib imported successfully")
except Exception as e:
    print(f"FAILED to import passlib: {e}")

print("Importing bcrypt...")
try:
    import bcrypt
    print(f"bcrypt imported successfully. Version: {bcrypt.__version__}")
except Exception as e:
    print(f"FAILED to import bcrypt: {e}")

print("Testing hash...")
try:
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hash = pwd_context.hash("test")
    print(f"Hash generated: {hash}")
    verify = pwd_context.verify("test", hash)
    print(f"Verification: {verify}")
except Exception as e:
    print(f"FAILED to hash/verify: {e}")
