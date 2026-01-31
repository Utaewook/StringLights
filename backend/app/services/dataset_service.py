
import os
import shutil
import uuid
import json
import time
from typing import List, Dict, Any
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.utils.logger import setup_logger
from app.utils.data_utils import generate_dummy_inputs, validate_npz_inputs, save_inputs
from app.repositories.model_repo import model_repo
from app.repositories.dataset_repo import dataset_repo, tensor_repo
from app.models.dataset import Dataset, Tensor
from app.schemas.dataset import InputGenerationRequest, TensorInfo, DatasetResponse

logger = setup_logger("backend.service.dataset")

class DatasetService:
    def generate_inputs(self, db: Session, model_id: str, request: InputGenerationRequest) -> Dict[str, Any]:
        model = model_repo.get(db, model_id)
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")

        model_data_dir = os.path.join(settings.DATA_DIR, model_id)
        
        # Generate inputs
        try:
            model_path_file = os.path.join(model.path_files, model.filename)
            inputs = generate_dummy_inputs(model_path_file, request.dynamic_axes)
        except Exception as e:
            logger.error(f"Generation failed: {e}")
            raise HTTPException(status_code=422, detail=f"Failed to generate inputs: {str(e)}")

        # Save to FS
        dataset_id = str(uuid.uuid4())
        dataset_dir = os.path.join(model_data_dir, dataset_id)
        
        meta = {
            "id": dataset_id,
            "name": request.name,
            "type": "Auto",
            "created_at": time.time(),
            "dynamic_axes": request.dynamic_axes
        }
        
        save_inputs(dataset_dir, inputs, meta)
        
        # Save to DB
        dataset = Dataset(
            id=uuid.UUID(dataset_id),
            model_id=model.id,
            name=request.name,
            type="Auto",
            path_dir=dataset_dir,
            meta_info=meta
        )
        dataset_repo.create(db, dataset)
        
        # Save Tensors to DB
        for name, data in inputs.items():
            fname = f"{name}.npy"
            # Sanitize name logic duplicated from save_inputs is risky, relying on FS check or explicit logic
            # Let's rely on syncing or better explicit creation
            safe_name = "".join([c if c.isalnum() or c in "._-" else "_" for c in name])
            fname_safe = f"{safe_name}.npy"
            
            tensor = Tensor(
                dataset_id=dataset.id,
                name=name,
                filename=fname_safe,
                size_bytes=data.nbytes,
                dtype=str(data.dtype),
                shape=list(data.shape)
            )
            tensor_repo.create(db, tensor) # Individual commits might be slow but safe
            
        return meta

    def list_datasets(self, db: Session, model_id: str) -> List[DatasetResponse]:
        datasets = dataset_repo.get_by_model(db, model_id)
        return [
            DatasetResponse(
                id=str(d.id),
                name=d.name,
                type=d.type,
                created_at=d.created_at.timestamp() if d.created_at else 0
            ) 
            for d in datasets
        ]

    def upload_inputs(self, db: Session, model_id: str, file: UploadFile) -> Dict[str, Any]:
        if not file.filename.endswith(".npz"):
            raise HTTPException(status_code=400, detail="Only .npz files are supported")
            
        model = model_repo.get(db, model_id)
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")
            
        dataset_id = str(uuid.uuid4())
        model_data_dir = os.path.join(settings.DATA_DIR, model_id)
        dataset_dir = os.path.join(model_data_dir, dataset_id)
        os.makedirs(dataset_dir, exist_ok=True)
        
        # Save uploaded NPZ
        target_path = os.path.join(dataset_dir, "bundle.npz")
        try:
            with open(target_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            shutil.rmtree(dataset_dir)
            raise HTTPException(status_code=500, detail="Failed to save file")
            
        # Validate
        model_path_file = os.path.join(model.path_files, model.filename)
        if not validate_npz_inputs(model_path_file, target_path):
             shutil.rmtree(dataset_dir)
             raise HTTPException(status_code=422, detail="Starting input validation failed. Inputs do not match model.")
             
        # Extract and Save individual NPYs
        import numpy as np
        inputs = {}
        with np.load(target_path) as data:
            for k in data.files:
                inputs[k] = data[k]
                
        # Re-save as individual NPYs and Meta
        meta = {
            "id": dataset_id,
            "name": file.filename,
            "type": "Manual",
            "created_at": time.time()
        }
        save_inputs(dataset_dir, inputs, meta)
        
        # Save DB
        dataset = Dataset(
            id=uuid.UUID(dataset_id),
            model_id=model.id,
            name=file.filename,
            type="Manual",
            path_dir=dataset_dir,
            meta_info=meta
        )
        dataset_repo.create(db, dataset)
        
        # Save Tensors DB
        for name, data in inputs.items():
            safe_name = "".join([c if c.isalnum() or c in "._-" else "_" for c in name])
            fname_safe = f"{safe_name}.npy"
            tensor = Tensor(
                dataset_id=dataset.id,
                name=name,
                filename=fname_safe,
                size_bytes=data.nbytes,
                dtype=str(data.dtype),
                shape=list(data.shape)
            )
            tensor_repo.create(db, tensor)
            
        return meta

    def get_tensors(self, db: Session, model_id: str, dataset_id: str) -> List[TensorInfo]:
        # Validate Model/Dataset relation
        # In a strict service, we should check ownership, but for now trusting IDs
        tensors = tensor_repo.get_by_dataset(db, dataset_id)
        return [
            TensorInfo(
                name=t.filename, 
                tensor_name=t.name,
                size_bytes=t.size_bytes or 0,
                filename=t.filename
            )
            for t in tensors
        ]

dataset_service = DatasetService()
