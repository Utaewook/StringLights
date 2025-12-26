from celery import Celery
import os

# Redis connection URL (using environment variable or default)
BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/0")

celery_app = Celery(
    "worker",
    broker=BROKER_URL,
    backend=BROKER_URL
)

@celery_app.task
def example_task(x, y):
    return x + y
