import requests
import sys
from datetime import datetime

# Login
login_url = "http://localhost:8004/api/auth/login"
perf_url = "http://localhost:8004/api/performance/table-data"
agent_perf_url = "http://localhost:8004/api/performance/by-agent"

try:
    print(f"Logging in...")
    resp = requests.post(login_url, json={"username": "admin", "password": "admin123"})
    if resp.status_code != 200:
        print(f"Login failed: {resp.status_code} {resp.text}")
        sys.exit(1)
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    print("\n--- Testing /performance/table-data ---")
    resp = requests.get(perf_url, headers=headers)
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        print(f"Data Summary: {data.get('summary')}")
        print(f"Rows: {len(data.get('data', []))}")
        for row in data.get('data', []):
            print(f" - {row['agent']}: Total={row['total']}, Completed={row['completed']}")
    else:
        print(f"Error: {resp.text}")

    print("\n--- Testing /performance/by-agent ---")
    resp = requests.get(agent_perf_url, headers=headers)
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        print(f"Response: {resp.json()}")
    else:
        print(f"Error: {resp.text}")

    print("\n--- Testing /performance/by-product ---")
    product_perf_url = "http://localhost:8004/api/performance/by-product"
    resp = requests.get(product_perf_url, headers=headers)
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        print(f"Response: {resp.json()}")
    else:
        print(f"Error: {resp.text}")

except Exception as e:
    print(f"Exception: {e}")
