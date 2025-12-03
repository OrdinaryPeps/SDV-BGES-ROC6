import requests
import sys
import json

# Login
login_url = "http://localhost:8004/api/auth/login"
agent_perf_url = "http://localhost:8004/api/performance/by-agent"

try:
    resp = requests.post(login_url, json={"username": "admin", "password": "admin123"})
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    print("\n--- Testing /performance/by-agent ---")
    resp = requests.get(agent_perf_url, headers=headers)
    if resp.status_code == 200:
        print(json.dumps(resp.json(), indent=2))
    else:
        print(f"Error: {resp.text}")

except Exception as e:
    print(f"Exception: {e}")
