import os
import uuid
import shutil
import json
from typing import List
from fastapi import FastAPI, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from core import parse_onnx_model
from inference_core import generate_dummy_inputs, validate_npz_inputs, save_inputs
from models import ModelResponse, InputGenerationRequest
from utils.logger import setup_logger

# Environment variables
MODEL_DIR = os.environ.get("MODEL_DIR", "./model")
LOG_DIR = os.environ.get("LOG_DIR", "./logs")
DATA_DIR = os.environ.get("DATA_DIR", "/data")

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
os.makedirs(DATA_DIR, exist_ok=True)

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
    # Model storage: /model/{model_id}
    model_save_dir = os.path.join(MODEL_DIR, model_id)
    os.makedirs(model_save_dir, exist_ok=True)
    
    # Data storage: /data/{model_id} (Pre-create to match model_id)
    data_save_dir = os.path.join(DATA_DIR, model_id)
    os.makedirs(data_save_dir, exist_ok=True)
    
    target_path = os.path.join(model_save_dir, "model.onnx")
    
    # Save file
    try:
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        logger.info(f"File saved to {target_path}")
    except Exception as e:
        logger.error(f"File save error: {str(e)}")
        shutil.rmtree(model_save_dir) # Cleanup model dir
        if os.path.exists(data_save_dir):
            shutil.rmtree(data_save_dir) # Cleanup data dir
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
        
    # Parse model
    try:
        response = parse_onnx_model(target_path, model_id, file.filename, session_id)
        
        # Save meta json for caching in model dir
        with open(os.path.join(model_save_dir, "meta.json"), "w") as f:
            f.write(response.json())
        
        logger.info(f"Model parsed and saved successfully. ID: {model_id}, Session: {session_id}")
        return response
    except Exception as e:
        logger.error(f"Parsing error: {e}", exc_info=True)
        # Cleanup on fail
        shutil.rmtree(model_save_dir)
        if os.path.exists(data_save_dir):
            shutil.rmtree(data_save_dir)
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
                
    # Sort by timestamp desc safely
    def get_timestamp(x):
        ts = x.get('upload_timestamp', 0)
        try:
            return float(ts)
        except (TypeError, ValueError):
            return 0.0
            
    results.sort(key=get_timestamp, reverse=True)
    return results

@app.post("/models/{model_id}/inputs/generate")
async def generate_inputs(model_id: str, request: InputGenerationRequest):
    logger.info(f"Generating dummy inputs for model: {model_id}")
    model_path = os.path.join(MODEL_DIR, model_id, "model.onnx")
    if not os.path.exists(model_path):
        raise HTTPException(status_code=404, detail="Model file not found")
        
    try:
        inputs = generate_dummy_inputs(model_path, request.dynamic_axes)
        # Change save_dir to /data/[model_id]
        save_dir = os.path.join(DATA_DIR, model_id)
        path = save_inputs(save_dir, inputs)
        
        logger.info(f"Dummy inputs generated and saved to {path} (using input tensor names)")
        return {"message": "Inputs generated successfully", "path": path}
    except Exception as e:
        logger.error(f"Generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate inputs: {str(e)}")

@app.post("/models/{model_id}/inputs/upload")
async def upload_inputs(model_id: str, file: UploadFile):
    logger.info(f"Uploading inputs for model: {model_id}")
    if not file.filename.endswith(".npz"):
        raise HTTPException(status_code=400, detail="Only .npz files are supported")
        
    model_dir = os.path.join(MODEL_DIR, model_id)
    if not os.path.exists(model_dir):
        raise HTTPException(status_code=404, detail="Model not found")
        
    # Change save_dir to /data/[model_id]
    save_dir = os.path.join(DATA_DIR, model_id)
    os.makedirs(save_dir, exist_ok=True)
    target_path = os.path.join(save_dir, file.filename) # Keep uploaded filename but in /data
    
    try:
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Validate
        model_path = os.path.join(model_dir, "model.onnx")
        if validate_npz_inputs(model_path, target_path):
            logger.info(f"Inputs uploaded and validated: {target_path}")
            return {"message": "Inputs uploaded and validated successfully"}
        else:
            if os.path.exists(target_path):
                os.remove(target_path)
            raise HTTPException(status_code=422, detail="NPZ file does not match model inputs")
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload inputs: {str(e)}")
