
import os
import shutil
import uuid
import json
from typing import List
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.utils.logger import setup_logger
from app.utils.onnx_utils import parse_onnx_model
from app.repositories.model_repo import model_repo
from app.models.model import Model

logger = setup_logger("backend.service.model")

class ModelService:
    def upload_model(self, db: Session, file: UploadFile, session_id: str) -> dict:
        if not file.filename.endswith(".onnx"):
            raise HTTPException(status_code=400, detail="Only .onnx files are supported")
        
        model_id = str(uuid.uuid4())
        model_save_dir = os.path.join(settings.MODEL_DIR, model_id)
        os.makedirs(model_save_dir, exist_ok=True)
        
        data_save_dir = os.path.join(settings.DATA_DIR, model_id)
        os.makedirs(data_save_dir, exist_ok=True)
        
        target_path = os.path.join(model_save_dir, "model.onnx")
        
        try:
            with open(target_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            shutil.rmtree(model_save_dir)
            if os.path.exists(data_save_dir): shutil.rmtree(data_save_dir)
            raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

        try:
            # Parse ONNX
            response = parse_onnx_model(target_path, model_id, file.filename, session_id)
            
            # Save Meta
            with open(os.path.join(model_save_dir, "meta.json"), "w") as f:
                f.write(response.json())
            
            # Save to DB
            model_orm = Model(
                id=uuid.UUID(model_id),
                session_id=session_id,
                filename=file.filename,
                path_files=model_save_dir,
                filesize_bytes=os.path.getsize(target_path),
                ir_version=response.meta.ir_version,
                opset_version=response.meta.opset_version,
                graph_name=response.meta.graph_name,
                meta_info=json.loads(response.json())
            )
            # Use Repo
            model_repo.create(db, model_orm)
            
            return response
        except Exception as e:
            logger.error(f"Parsing error: {e}", exc_info=True)
            shutil.rmtree(model_save_dir)
            if os.path.exists(data_save_dir): shutil.rmtree(data_save_dir)
            raise HTTPException(status_code=422, detail=f"Failed to parse ONNX model: {str(e)}")

    def list_models(self, db: Session, session_id: str) -> List[dict]:
        models = model_repo.get_by_session(db, session_id)
        results = []
        for m in models:
            if m.meta_info:
                results.append(m.meta_info)
            else:
                results.append({
                    "id": str(m.id),
                    "filename": m.filename,
                    "upload_timestamp": m.created_at.timestamp() if m.created_at else 0,
                    "meta": {},
                    "inputs": [],
                    "outputs": []
                })
        return results

model_service = ModelService()
