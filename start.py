# start of start.py
import logging

# Configure the logging layout and level
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

if __name__ == "__main__":
    logging.debug("Python Server Initialized")
# end of start.py
