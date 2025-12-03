import requests
import sys

# Login first to get token
# Target backend directly to avoid proxy issues for token retrieval
login_url = "http://localhost:8004/api/auth/login"
tickets_url = "http://localhost:8004/api/tickets/"

try:
    # 1. Login
    print(f"Logging in to {login_url}...")
    resp = requests.post(login_url, json={"username": "admin", "password": "admin123"})
    if resp.status_code != 200:
        print(f"Login failed: {resp.status_code} {resp.text}")
        sys.exit(1)
        
    token = resp.json()["access_token"]
    print(f"TOKEN: {token}")
    
    # 2. Test Preflight (OPTIONS)
    print(f"Testing OPTIONS on {tickets_url} with Origin: http://localhost:3000...")
    headers_opt = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization"
    }
    resp_opt = requests.options(tickets_url, headers=headers_opt)
    print(f"OPTIONS Status: {resp_opt.status_code}")
    print(f"OPTIONS Headers: {resp_opt.headers}")

    # 3. Fetch Tickets (Directly with CORS Header)
    print(f"Fetching tickets from {tickets_url} with Origin: http://localhost:3000...")
    headers = {
        "Authorization": f"Bearer {token}",
        "Origin": "http://localhost:3000"
    }
    resp = requests.get(tickets_url, headers=headers)
    
    print(f"Status: {resp.status_code}")
    print(f"Headers: {resp.headers}")
    if resp.status_code == 200:
        tickets = resp.json()
        print(f"Success! Found {len(tickets)} tickets.")
    else:
        print(f"Failed: {resp.text}")

except Exception as e:
    print(f"Error: {e}")
