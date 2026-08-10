from loguru import logger
import sys

# Configure logger
logger.remove()
logger.add(sys.stdout, level="INFO", format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | {message}")
logger.add("logs/finforge.log", rotation="10 MB", level="DEBUG")

# Export logger
__all__ = ["logger"]