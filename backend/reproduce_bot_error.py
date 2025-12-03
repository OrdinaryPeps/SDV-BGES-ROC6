import requests
import sys
import json

login_url = "http://localhost:8004/api/auth/login"
create_ticket_url = "http://localhost:8004/api/tickets/"

try:
    # Login as admin (bot uses admin credentials)
    resp = requests.post(login_url, json={"username": "admin", "password": "admin123"})
    if resp.status_code != 200:
        print(f"Login failed: {resp.status_code}")
        sys.exit(1)
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Simulate QC2 Ticket Payload from Bot
    # Based on bot_telegram_backend.js lines 789-820 and QC2 handler
    payload = {
        "user_telegram_id": "123456789",
        "user_telegram_name": "@testuser",
        "category": "QC2 - HSI",
        "description": "PERMINTAAN: QC2\nNOMOR ORDER: SC12312412\nWONUM: W03513412312\nND INET/VOICE: 1621312412421\nKETERANGAN LAINNYA: -",
        "permintaan": "QC2",
        "tipe_transaksi": "-",
        "order_number": "SC12312412",
        "wonum": "W03513412312",
        "tiket_fo": None, # undefined in bot becomes undefined in JSON? No, JS undefined usually omitted or null. 
                          # In bot code: tiket_fo: input.tiketFO. input.tiketFO is undefined for QC2.
                          # So it sends undefined? Axios might skip it or send null.
                          # Let's assume it sends null or omits it. Pydantic handles missing optional fields.
                          # But wait, line 798: tiket_fo: input.tiketFO
                          # If input.tiketFO is undefined, the key exists with value undefined.
                          # JSON.stringify(undefined) removes the key.
                          # So these keys are likely missing in the JSON payload.
        "nd_internet_voice": "1621312412421",
        "password": None,
        "paket_inet": None,
        "sn_lama": None,
        "sn_baru": None,
        "sn_ap": None,
        "mac_ap": None,
        "ssid": None,
        "tipe_ont": None,
        "gpon_slot_port": None,
        "vlan": None,
        "svlan": None,
        "cvlan": None,
        "task_bima": None,
        "ownergroup": None,
        "keterangan_lainnya": "-",
        "bi_id": None,
        "cfs_id": None,
        "id_bi": None,
        "rfs_id": None
    }
    
    # Remove None values to simulate JSON.stringify behavior for undefined
    # But wait, in JS: { a: undefined } -> {}
    # In the bot code, input.tiketFO is undefined.
    # So we should remove keys that are None in my payload map above, 
    # EXCEPT for those explicitly set to '-' or values.
    
    clean_payload = {k: v for k, v in payload.items() if v is not None}
    
    # However, the bot code sets some fields explicitly.
    # line 798: tiket_fo: input.tiketFO. If input.tiketFO is undefined, it is undefined.
    
    print("Payload:", json.dumps(clean_payload, indent=2))

    resp = requests.post(create_ticket_url, json=clean_payload, headers=headers)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text}")

except Exception as e:
    print(f"Error: {e}")
