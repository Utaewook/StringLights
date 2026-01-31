
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
    def upload_model(self, db: Session, files: List[UploadFile], session_id: str) -> dict:
        if not files:
            raise HTTPException(status_code=400, detail="No files uploaded")

        model_id = str(uuid.uuid4())
        model_save_dir = os.path.join(settings.MODEL_DIR, model_id)
        os.makedirs(model_save_dir, exist_ok=True)
        
        data_save_dir = os.path.join(settings.DATA_DIR, model_id)
        os.makedirs(data_save_dir, exist_ok=True)
        
        saved_files = []
        main_model_path = None
        main_filename = None

        try:
            # 1. Save all files
            for file in files:
                file_path = os.path.join(model_save_dir, file.filename)
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)
                saved_files.append(file_path)
                
                # Determine main model file (Current priority: ONNX only)
                if file.filename.endswith(".onnx"):
                    main_model_path = file_path
                    main_filename = file.filename

            # 2. Validation: Check if main model exists
            if not main_model_path:
                raise HTTPException(status_code=400, detail="No supported model file (.onnx) found in the uploaded files.")

            # 3. Parse ONNX (Includes validation for external data)
            response = parse_onnx_model(main_model_path, model_id, main_filename, session_id)
            
            # Save Meta
            with open(os.path.join(model_save_dir, "meta.json"), "w") as f:
                f.write(response.json())
            
            # Save to DB
            total_size = sum(os.path.getsize(f) for f in saved_files)
            
            model_orm = Model(
                id=uuid.UUID(model_id),
                session_id=session_id,
                filename=main_filename,
                path_files=model_save_dir,
                filesize_bytes=total_size,
                ir_version=response.meta.ir_version,
                opset_version=response.meta.opset_version,
                graph_name=response.meta.graph_name,
                meta_info=json.loads(response.json())
            )
            model_repo.create(db, model_orm)
            
            return response

        except Exception as e:
            logger.error(f"Error during model upload/parsing: {e}", exc_info=True)
            if os.path.exists(model_save_dir): shutil.rmtree(model_save_dir)
            if os.path.exists(data_save_dir): shutil.rmtree(data_save_dir)
            
            if isinstance(e, HTTPException): raise e
            raise HTTPException(status_code=422, detail=f"Failed to process model: {str(e)}")

    def upload_model_file(self, db: Session, model_id: str, files: List[UploadFile], session_id: str) -> dict:
        model = model_repo.get(db, uuid.UUID(model_id))
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")
            
        model_save_dir = model.path_files
        
        try:
            for file in files:
                file_path = os.path.join(model_save_dir, file.filename)
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)
            
            # Re-validate
            main_model_path = os.path.join(model_save_dir, model.filename)
            response = parse_onnx_model(main_model_path, model_id, model.filename, session_id)
            
            # Update Meta
            with open(os.path.join(model_save_dir, "meta.json"), "w") as f:
                f.write(response.json())
                
            model.meta_info = json.loads(response.json())
            model.filesize_bytes = sum(os.path.getsize(os.path.join(model_save_dir, f)) for f in os.listdir(model_save_dir) if os.path.isfile(os.path.join(model_save_dir, f)))
            db.commit()
            db.refresh(model)
            
            return response
            
        except Exception as e:
            logger.error(f"Error appending file: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to append file: {str(e)}")

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
