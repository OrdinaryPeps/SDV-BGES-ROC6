import psutil
print("Checking port 8001...")
found = False
for conn in psutil.net_connections():
    if conn.laddr.port == 8001:
        found = True
        print(f"Port 8001 is used by PID: {conn.pid}")
        try:
            p = psutil.Process(conn.pid)
            print(f"Process Name: {p.name()}")
            print(f"Command Line: {p.cmdline()}")
        except Exception as e:
            print(f"Could not get process details: {e}")

if not found:
    print("No process found on port 8001")
