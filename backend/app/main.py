
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.utils.logger import setup_logger
from app.api.v1.api import api_router
from app.db.base import Base
from app.db.session import engine

# Make sure imports are there for Base to see models
from app.models import model, dataset, run

logger = setup_logger("backend_core")

app = FastAPI(title="String Lights API", version="1.0.0")

# CORS config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure directories exist
os.makedirs(settings.MODEL_DIR, exist_ok=True)
os.makedirs(settings.LOG_DIR, exist_ok=True)
os.makedirs(settings.DATA_DIR, exist_ok=True)

@app.on_event("startup")
async def startup_event():
    logger.info(f"String Lights Backend Started. Model Dir: {settings.MODEL_DIR}")
    # Ensure tables exist (better to use Alembic, but keep for simple dev)
    Base.metadata.create_all(bind=engine)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    client_ip = request.client.host
    method = request.method
    url = request.url.path
    
    logger.info(f"Request: {method} {url} from {client_ip}")
    
    try:
        response = await call_next(request)
        logger.info(f"Response: {method} {url} status={response.status_code}")
        return response
    except Exception as e:
        logger.error(f"Request Failed: {method} {url} error={str(e)}")
        raise e

@app.get("/")
def read_root():
    return {"Hello": "String Lights Backend API (Modular Version)"}

app.include_router(api_router)
