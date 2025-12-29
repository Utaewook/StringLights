from celery import Celery
import os
from utils.logger import setup_logger

# Setup logger
logger = setup_logger("worker")

# Redis connection URL
BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/0")

celery_app = Celery(
    "worker",
    broker=BROKER_URL,
    backend=BROKER_URL
)

logger.info(f"Worker started with broker: {BROKER_URL}")

@celery_app.task
def example_task(x, y):
    logger.info(f"Received task: example_task({x}, {y})")
    try:
        result = x + y
        logger.info(f"Task finished. Result: {result}")
        return result
    except Exception as e:
        logger.error(f"Task failed: {e}", exc_info=True)
        raise e
