import logging
import os
from datetime import datetime

# Setup paths
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../"))
LOG_DIR = os.path.join(PROJECT_ROOT, "logs")

if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

# Configure the logger
log_file = os.path.join(LOG_DIR, "python_engine.log")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    handlers=[
        logging.FileHandler(log_file), # Writes to file
        logging.StreamHandler()        # Still prints to terminal for Node.js to see
    ]
)

logger = logging.getLogger("EngineLogger")