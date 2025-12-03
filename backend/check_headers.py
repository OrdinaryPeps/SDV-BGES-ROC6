import requests
import sys

login_url = "http://localhost:8004/api/auth/login"
export_url = "http://localhost:8004/api/export/performance?format=xlsx"

try:
    # Login
    resp = requests.post(login_url, json={"username": "admin", "password": "admin123"})
    if resp.status_code != 200:
        print(f"Login failed: {resp.status_code}")
        sys.exit(1)
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Check Headers
    resp = requests.get(export_url, headers=headers)
    print(f"Status: {resp.status_code}")
    print(f"Headers: {resp.headers}")
    print(f"Content-Disposition: {resp.headers.get('Content-Disposition')}")
    print(f"Content-Type: {resp.headers.get('Content-Type')}")

except Exception as e:
    print(f"Error: {e}")
