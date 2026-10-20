# start of start.py
import logging
import time
import sys
import json
import os

# Configure the logging layout and level
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def log_to_json_file(activation_reason, commands_list, runtime_seconds):
    """
    Manages and saves execution data profiles directly inside python_logs.json.
    Maintains a maximum strict ceiling cap of exactly 300 logs.
    """
    log_file_path = "python_logs.json"
    logs_array = []
    
    # 1. Safely pull down existing record entries if the ledger file exists
    if os.path.exists(log_file_path):
        try:
            with open(log_file_path, "r") as f:
                logs_array = json.load(f)
                if not isinstance(logs_array, list):
                    logs_array = []
        except Exception:
            logs_array = []
            
    # 2. Build out the new structured runtime entry block
    new_entry = {
        "last_active_timestamp": int(time.time()),
        "activated_by": activation_reason,
        "commands_ran": commands_list,
        "runtime_duration_seconds": round(runtime_seconds, 2)
    }
    
    # 3. Append to the timeline history
    logs_array.append(new_entry)
    
    # 4. Strict ceiling clamp rule: Chop away oldest entries if hitting index 301+
    while len(logs_array) > 300:
        logs_array.pop(0)
        
    # 5. Lock and commit the data array cleanly back to disk
    try:
        with open(log_file_path, "w") as f:
            json.dump(logs_array, f, indent=4)
    except Exception as e:
        logging.error(f"Failed writing background ledger update: {e}")

if __name__ == "__main__":
    server_start_time = time.time()
    
    # Initialize default configuration variables
    version_string = "Unknown"
    linkbot_enabled = True
    under13_strict_privacy = True
    
    # Safely load configurations dynamically from your config.json layout file
    try:
        with open("config.json", "r") as config_file:
            config_data = json.load(config_file)
            
            # Extract main variables matching your exact JSON structure keys
            version_string = config_data.get("version", "Unknown")
            
            bots_config = config_data.get("bots", {})
            linkbot_enabled = bots_config.get("linkbot", {}).get("enabled", True)
            
            safety_config = config_data.get("safetyMode", {})
            under13_strict_privacy = safety_config.get("under13StrictPrivacy", True)
            
    except Exception:
        # Fallback gracefully if the configuration file is temporarily unreadable
        pass

    # 📝 Logs exactly once right here when the container starts up
    logging.debug(f"Python Server Initialized - running on V{version_string}")
    
    # Timing triggers tracking setup
    last_network_check = 0.0
    network_interval = 3.0  
    
    # Tracking logs collection cache arrays
    session_commands_executed = []
    session_trigger_reason = "System Container Startup Loop"
    
    try:
        while True:
            current_time = time.time()
            
            # --- 1. Throttled Network Database Sync (Runs every 3 seconds) ---
            if current_time - last_network_check >= network_interval:
                # 🍇 PLACE YOUR QUIET FIREBASE / CHAT BOT REPORT CHECKS HERE!
                # Example tracking placeholder when operations run:
                # session_commands_executed.append("/check_chat_flags")
                
                last_network_check = current_time
                
                # Update our live metrics file registry with the current runtime history profile
                current_runtime = current_time - server_start_time
                log_to_json_file(session_trigger_reason, session_commands_executed, current_runtime)
            
            # --- 2. Optimized Internal Loop Processing (Runs every 800ms) ---
            time.sleep(0.8) 
            
    except KeyboardInterrupt:
        final_runtime = time.time() - server_start_time
        log_to_json_file("Manual Terminal Interruption SigTerm", session_commands_executed, final_runtime)
        logging.debug("Python Server Shutting Down Safely via Terminal Instruction.")
# end of start.py
