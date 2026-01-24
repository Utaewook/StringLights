
from celery import Celery
from app.core.config import settings

celery_app = Celery("worker", broker=f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0")

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Seoul",
    enable_utc=True,
)
