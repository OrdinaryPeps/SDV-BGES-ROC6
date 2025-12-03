import requests

def verify_api():
    base_url = "http://localhost:8003/api"
    print(f"Attempting login to {base_url}/auth/login...")
    try:
        response = requests.post(
            f"{base_url}/auth/login",
            json={"username": "admin", "password": "admin123"}
        )
        print(f"Login Status: {response.status_code}")
        print(f"Headers: {response.headers}")
        print(f"Content: {response.content}")
        
        if response.status_code == 200:
            print("LOGIN SUCCESS!")
            token = response.json()["access_token"]
            print(f"Token: {token[:20]}...")
        else:
            print(f"LOGIN FAILED: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify_api()
