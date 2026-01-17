
from fastapi import APIRouter
from app.api.v1.endpoints import models, datasets

api_router = APIRouter()
api_router.include_router(models.router, prefix="/models", tags=["models"])
api_router.include_router(datasets.router, prefix="/models", tags=["datasets"])
