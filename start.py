# start of start.py
import logging
import time
import sys
import json  

# Configure the logging layout and level
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

if __name__ == "__main__":
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

    # 📝 Logs exactly once right here when the container starts up—clean and straight to the point!
    logging.debug(f"Python Server Initialized - running on V{version_string}")
    
    # Timing triggers tracking setup
    last_network_check = 0.0
    network_interval = 3.0  
    
    try:
        while True:
            current_time = time.time()
            
            # --- 1. Throttled Network Database Sync (Runs every 3 seconds) ---
            if current_time - last_network_check >= network_interval:
                # 🍇 PLACE YOUR QUIET FIREBASE / CHAT BOT REPORT CHECKS HERE!
                last_network_check = current_time
            
            # --- 2. Optimized Internal Loop Processing (Runs every 800ms) ---
            time.sleep(0.8) 
            
    except KeyboardInterrupt:
        logging.debug("Python Server Shutting Down Safely via Terminal Instruction.")
# end of start.py
