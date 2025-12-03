import requests
import sys
from datetime import datetime, timedelta, timezone

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

    # 1. Fetch ALL tickets to see what we have
    print("\n--- ALL TICKETS ---")
    resp = requests.get(tickets_url, headers=headers)
    all_tickets = resp.json()
    for t in all_tickets:
        print(f"Ticket: {t['ticket_number']}, Created: {t['created_at']}")

    # 2. Fetch TODAY ONLY tickets
    print("\n--- TODAY ONLY TICKETS ---")
    resp = requests.get(tickets_url, headers=headers, params={"today_only": "true"})
    today_tickets = resp.json()
    for t in today_tickets:
        print(f"Ticket: {t['ticket_number']}, Created: {t['created_at']}")

    print(f"\nTotal: {len(all_tickets)}, Today: {len(today_tickets)}")

except Exception as e:
    print(f"Error: {e}")
