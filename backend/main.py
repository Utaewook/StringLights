import os
import uuid
import shutil
import json
from typing import List
from fastapi import FastAPI, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from models import ModelResponse
from core import parse_onnx_model
from utils.logger import setup_logger

# Environment variables
MODEL_DIR = os.environ.get("MODEL_DIR", "./model")
LOG_DIR = os.environ.get("LOG_DIR", "./logs")

# Setup Logger
logger = setup_logger("backend")

app = FastAPI()

# CORS config (allow frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure directories exist
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)

@app.on_event("startup")
async def startup_event():
    logger.info(f"String Lights Backend Started. Model Dir: {MODEL_DIR}, Log Dir: {LOG_DIR}")

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
    return {"Hello": "String Lights Backend API"}

@app.post("/models/upload", response_model=ModelResponse)
async def upload_model(file: UploadFile, request: Request):
    logger.info(f"Upload request received for file: {file.filename}")
    
    session_id = request.headers.get("X-Session-Id")
    if not session_id:
        # Fallback or error? For now, let's require it or default to "public"
        session_id = "public"
        logger.warning("No X-Session-Id header provided. Using 'public'.")
    
    if not file.filename.endswith(".onnx"):
        logger.warning("Upload rejected: Invalid file extension")
        raise HTTPException(status_code=400, detail="Only .onnx files are supported")
    
    model_id = str(uuid.uuid4())
    save_dir = os.path.join(MODEL_DIR, model_id)
    os.makedirs(save_dir, exist_ok=True)
    
    target_path = os.path.join(save_dir, "model.onnx")
    
    # Save file
    try:
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        logger.info(f"File saved to {target_path}")
    except Exception as e:
        logger.error(f"File save error: {str(e)}")
        shutil.rmtree(save_dir) # Cleanup
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
        
    # Parse model
    try:
        response = parse_onnx_model(target_path, model_id, file.filename, session_id)
        
        # Save meta json for caching
        with open(os.path.join(save_dir, "meta.json"), "w") as f:
            f.write(response.json())
        
        logger.info(f"Model parsed and saved successfully: {model_id}")
        return response
    except Exception as e:
        logger.error(f"Parsing error: {e}", exc_info=True)
        raise HTTPException(status_code=422, detail=f"Failed to parse ONNX model: {str(e)}")

@app.get("/models", response_model=List[ModelResponse])
def list_models(session_id: str = "public"):
    logger.info(f"Listing models for session: {session_id}")
    results = []
    # Scan directory
    if not os.path.exists(MODEL_DIR):
        return []
        
    for model_id in os.listdir(MODEL_DIR):
        model_path = os.path.join(MODEL_DIR, model_id)
        meta_path = os.path.join(model_path, "meta.json")
        
        if os.path.isdir(model_path) and os.path.exists(meta_path):
            try:
                with open(meta_path, "r") as f:
                   data = json.load(f)
                   # Filter by session_id
                   # Support backward compatibility for old files without session_id (treat as public)
                   model_session = data.get("meta", {}).get("session_id", "public")
                   
                   if model_session == session_id:
                       results.append(data)
            except Exception as e:
                logger.warning(f"Failed to load meta for {model_id}: {e}")
                continue
                
    # Sort by timestamp desc?
    results.sort(key=lambda x: x.get('upload_timestamp', 0), reverse=True)
    return results
