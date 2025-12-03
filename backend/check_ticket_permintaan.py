import requests
import sys

# Login
login_url = "http://localhost:8004/api/auth/login"
tickets_url = "http://localhost:8004/api/tickets/"

try:
    print(f"Logging in...")
    resp = requests.post(login_url, json={"username": "admin", "password": "admin123"})
    if resp.status_code != 200:
        print(f"Login failed: {resp.status_code} {resp.text}")
        sys.exit(1)
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    print("\n--- Checking Tickets Permintaan ---")
    resp = requests.get(tickets_url, headers=headers)
    tickets = resp.json()
    for t in tickets:
        print(f"Ticket: {t['ticket_number']}, Permintaan: '{t.get('permintaan')}', Category: '{t.get('category')}'")

except Exception as e:
    print(f"Error: {e}")
