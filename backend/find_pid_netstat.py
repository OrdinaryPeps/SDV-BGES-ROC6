import subprocess

try:
    output = subprocess.check_output("netstat -ano", shell=True).decode('cp437', errors='ignore')
    print("Netstat output captured.")
    for line in output.splitlines():
        if "LISTENING" in line and (":8001" in line or ":8002" in line):
            print(f"Found: {line.strip()}")
except Exception as e:
    print(f"Error: {e}")
