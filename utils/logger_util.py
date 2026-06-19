import logging
import os
from datetime import datetime
from logging.handlers import TimedRotatingFileHandler

# Setup paths
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../"))
LOG_DIR = os.path.join(PROJECT_ROOT, "logs")

if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

# Get current date for the base file naming format
current_date = datetime.now().strftime("%Y-%m-%d")
log_file = os.path.join(LOG_DIR, f"python_engine-{current_date}.log")

# Setup clean timestamp and layout formats
log_format = '%(asctime)s | %(levelname)s | [%(type)s] | %(message)s'
date_format = '%Y-%m-%d %H:%M:%S'  # Kept the date to match your log type example

# 💡 1. Create a Filter to safely auto-inject missing 'type' keys for third-party libraries
class LogTypeInjectFilter(logging.Filter):
    def filter(self, record):
        if not hasattr(record, 'type'):
            # Automatically tag third-party library calls (Groq, OpenAI, httpx)
            if any(pkg in record.name for pkg in ['openai', 'groq', 'httpx', 'httpcore']):
                record.type = "GROQ_API"
            else:
                record.type = "ENGINE"
        return True

# 2. Setup the Logger instance
logger = logging.getLogger() # Configures the Root logger so it intercepts Groq/OpenAI too
logger.setLevel(logging.INFO)

# Clear existing handlers to prevent duplication errors
if logger.handlers:
    logger.handlers.clear()

# ⏱️ File Handler (Rotates daily at midnight)
file_handler = TimedRotatingFileHandler(
    log_file,
    when="midnight",
    interval=1,
    backupCount=30,
    encoding="utf-8"
)
file_handler.suffix = "%Y-%m-%d"
file_formatter = logging.Formatter(fmt=log_format, datefmt=date_format)
file_handler.setFormatter(file_formatter)
file_handler.addFilter(LogTypeInjectFilter()) # Attach the safety filter
logger.addHandler(file_handler)

# 🖥️ Stream Handler (Terminal Console)
stream_handler = logging.StreamHandler()
stream_formatter = logging.Formatter(fmt=log_format, datefmt=date_format)
stream_handler.setFormatter(stream_formatter)
stream_handler.addFilter(LogTypeInjectFilter()) # Attach the safety filter
logger.addHandler(stream_handler)


# 3. Helper function to make your custom app logging effortless
def log_with_type(level, msg, log_type="GENERAL", *args, **kwargs):
    extra_data = {'type': log_type}
    lvl = level.lower()
    
    if lvl == 'info':
        logger.info(msg, extra=extra_data, *args, **kwargs)
    elif lvl in ['warn', 'warning']:
        logger.warning(msg, extra=extra_data, *args, **kwargs)
    elif lvl == 'error':
        logger.error(msg, extra=extra_data, *args, **kwargs)
    elif lvl == 'critical':
        logger.critical(msg, extra=extra_data, *args, **kwargs)
    elif lvl == 'debug':
        logger.debug(msg, extra=extra_data, *args, **kwargs)