import os
import uuid
import shutil
import json
from typing import List, Optional
from fastapi import FastAPI, UploadFile, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from core import parse_onnx_model
from inference_core import generate_dummy_inputs, validate_npz_inputs, save_inputs
from models import ModelResponse, InputGenerationRequest
from utils.logger import setup_logger
from database import get_db, engine
from models_orm import Base, ModelORM, DatasetORM, TensorORM, RunORM

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
    # Ensure tables exist (Alembic should handle this, but for dev convenience)
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
    return {"Hello": "String Lights Backend API"}

@app.post("/models/upload", response_model=ModelResponse)
async def upload_model(file: UploadFile, request: Request, db: Session = Depends(get_db)):
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
            
        # Insert into DB
        model_orm = ModelORM(
            id=uuid.UUID(model_id),
            session_id=session_id,
            filename=file.filename,
            path_files=model_save_dir,
            filesize_bytes=os.path.getsize(target_path),
            ir_version=response.meta.ir_version,
            opset_version=response.meta.opset_version,
            graph_name=response.meta.graph_name,
            meta_info=json.loads(response.json()) # Store full response as JSON
        )
        db.add(model_orm)
        db.commit()
        db.refresh(model_orm)
        
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
def list_models(session_id: str = "public", db: Session = Depends(get_db)):
    logger.info(f"Listing models for session: {session_id}")
    
    # Query DB
    try:
        models = db.query(ModelORM).filter(ModelORM.session_id == session_id).order_by(ModelORM.created_at.desc()).all()
        
        results = []
        for m in models:
            # Map ORM to ModelResponse (using the meta_info which contains the full Pydantic structure)
            # Ensure meta_info has necessary fields, or construct explicitly
            if m.meta_info:
                results.append(m.meta_info)
            else:
                # Fallback construction if meta_info missing
                results.append({
                    "id": str(m.id),
                    "filename": m.filename,
                    "upload_timestamp": m.created_at.timestamp() if m.created_at else 0,
                    "meta": {},
                    "inputs": [],
                    "outputs": []
                })
        return results
    except Exception as e:
        logger.error(f"DB Query failed: {e}")
        return []

@app.post("/models/{model_id}/inputs/generate")
async def generate_inputs(model_id: str, request: InputGenerationRequest, db: Session = Depends(get_db)):
    logger.info(f"Generating dummy inputs for model: {model_id}, name: {request.name}")
    model_path = os.path.join(MODEL_DIR, model_id, "model.onnx")
    if not os.path.exists(model_path):
        raise HTTPException(status_code=404, detail="Model file not found")
        
    try:
        inputs = generate_dummy_inputs(model_path, request.dynamic_axes)
        
        # New: Dataset ID
        dataset_id = str(uuid.uuid4())
        save_dir = os.path.join(DATA_DIR, model_id, dataset_id)
        
        import time
        created_at_ts = time.time()
        meta = {
            "id": dataset_id,
            "name": request.name,
            "type": "Auto",
            "created_at": created_at_ts,
            "dynamic_axes": request.dynamic_axes
        }
        
        path = save_inputs(save_dir, inputs, meta=meta)
        
        # DB Insert
        try:
            dataset_orm = DatasetORM(
                id=uuid.UUID(dataset_id),
                model_id=uuid.UUID(model_id),
                name=request.name,
                type="Auto",
                path_dir=save_dir,
                meta_info=meta
            )
            db.add(dataset_orm)
            # Sync generated tensors as well? 
            # save_inputs generates .npy files. We can scan them and insert.
            for tensor_name, tensor_data in inputs.items():
                tensor_filename = f"{tensor_name}.npy" # Verify save_inputs naming logic
                # Actually save_inputs saves files named "{name}.npy" usually.
                # Assuming save_inputs saves them in save_dir
                
                # Check file existence to be sure
                tensor_path = os.path.join(save_dir, f"{tensor_name}.npy")
                if os.path.exists(tensor_path):
                    t_orm = TensorORM(
                        dataset_id=uuid.UUID(dataset_id),
                        name=tensor_name,
                        filename=f"{tensor_name}.npy",
                        size_bytes=os.path.getsize(tensor_path),
                        dtype=str(tensor_data.dtype),
                        shape=list(tensor_data.shape)
                    )
                    db.add(t_orm)

            db.commit()
        except Exception as db_e:
            logger.error(f"DB Error saving generated dataset: {db_e}")
            # Don't fail request if DB fails but file saved? Or rollback?
            # Rolling back file is hard. Proceed with warning.
            
        logger.info(f"Dataset '{request.name}' ({dataset_id}) generated and saved to {path}")
        return {"message": "Dataset generated successfully", "id": dataset_id, "name": request.name}
    except Exception as e:
        logger.error(f"Generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate inputs: {str(e)}")

@app.get("/models/{model_id}/datasets")
async def list_datasets(model_id: str, db: Session = Depends(get_db)):
    """
    List all input datasets for a specific model.
    """
    logger.info(f"Listing datasets for model: {model_id}")
    
    try:
        # Validate UUID
        try:
            m_uuid = uuid.UUID(model_id)
        except ValueError:
            return []

        datasets = db.query(DatasetORM).filter(DatasetORM.model_id == m_uuid).order_by(DatasetORM.created_at.desc()).all()
        
        results = []
        for d in datasets:
            if d.meta_info:
                results.append(d.meta_info)
            else:
                results.append({
                    "id": str(d.id),
                    "name": d.name,
                    "type": d.type,
                    "created_at": d.created_at.timestamp() if d.created_at else 0
                })
        return results
    except Exception as e:
        logger.error(f"DB Query failed: {e}")
        return []

@app.post("/models/{model_id}/inputs/upload")
async def upload_inputs(model_id: str, file: UploadFile, name: Optional[str] = None, db: Session = Depends(get_db)):
    logger.info(f"Uploading inputs for model: {model_id}, name: {name}")
    if not file.filename.endswith(".npz"):
        raise HTTPException(status_code=400, detail="Only .npz files are supported")
        
    model_dir = os.path.join(MODEL_DIR, model_id)
    if not os.path.exists(model_dir):
        raise HTTPException(status_code=404, detail="Model not found")
        
    # New: Dataset ID
    dataset_id = str(uuid.uuid4())
    save_dir = os.path.join(DATA_DIR, model_id, dataset_id)
    os.makedirs(save_dir, exist_ok=True)
    
    target_path = os.path.join(save_dir, "bundle.npz")
    
    try:
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Validate
        model_path = os.path.join(model_dir, "model.onnx")
        if validate_npz_inputs(model_path, target_path):
            import time
            created_at_ts = time.time()
            meta = {
                "id": dataset_id,
                "name": name or file.filename,
                "type": "Manual",
                "created_at": created_at_ts,
                "original_filename": file.filename
            }
            # Save metadata
            with open(os.path.join(save_dir, "dataset_meta.json"), "w") as f:
                json.dump(meta, f, indent=2)
            
            # DB Insert
            try:
                dataset_orm = DatasetORM(
                    id=uuid.UUID(dataset_id),
                    model_id=uuid.UUID(model_id),
                    name=meta['name'],
                    type="Manual",
                    path_dir=save_dir,
                    meta_info=meta
                )
                db.add(dataset_orm)
                db.commit()
                # Tensors sync currently skipped for manual upload - can be done on explore
            except Exception as db_e:
                logger.error(f"DB Error saving uploaded dataset: {db_e}")

            logger.info(f"Dataset '{meta['name']}' ({dataset_id}) uploaded and validated")
            return {"message": "Dataset uploaded successfully", "id": dataset_id, "name": meta['name']}
        else:
            if os.path.exists(save_dir):
                shutil.rmtree(save_dir)
            raise HTTPException(status_code=422, detail="NPZ file does not match model inputs")
    except Exception as e:
        logger.error(f"Upload error: {e}")
        if os.path.exists(save_dir):
            shutil.rmtree(save_dir)
        raise HTTPException(status_code=500, detail=f"Failed to upload inputs: {str(e)}")
@app.get("/models/{model_id}/datasets/{dataset_id}/tensors")
async def list_dataset_tensors(model_id: str, dataset_id: str):
    """
    List individual .npy tensor files in a specific dataset folder.
    """
    logger.info(f"Listing tensors for dataset: {dataset_id} in model: {model_id}")
    dataset_path = os.path.join(DATA_DIR, model_id, dataset_id)
    
    if not os.path.exists(dataset_path):
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    tensors = []
    for filename in os.listdir(dataset_path):
        if filename.endswith(".npy"):
            file_path = os.path.join(dataset_path, filename)
            stat = os.stat(file_path)
            tensors.append({
                "name": filename,
                "size_bytes": stat.st_size,
                "tensor_name": filename[:-4] # Remove .npy
            })
            
    # Sort alphabetically
    tensors.sort(key=lambda x: x['name'])
    return tensors
