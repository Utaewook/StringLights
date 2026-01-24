
from celery import Celery
from app.core.config import settings

# Initialize Celery
app = Celery("worker", broker=f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0")

# Configuration
app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Seoul",
    enable_utc=True,
    broker_connection_retry_on_startup=True,
)

# Load tasks
# Load tasks explicitly
app.conf.imports = ["app.tasks.inference"]
