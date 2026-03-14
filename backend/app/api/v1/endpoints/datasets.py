
from typing import List, Dict, Any
from fastapi import APIRouter, UploadFile, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.services.dataset_service import dataset_service
from app.schemas.dataset import InputGenerationRequest, TensorInfo, DatasetResponse

router = APIRouter()

@router.post("/{model_id}/inputs/generate")
async def generate_inputs(model_id: str, request: InputGenerationRequest, db: Session = Depends(get_db)):
    return dataset_service.generate_inputs(db, model_id, request)

@router.get("/{model_id}/datasets", response_model=List[DatasetResponse])
def list_datasets(model_id: str, db: Session = Depends(get_db)):
    return dataset_service.list_datasets(db, model_id)

@router.post("/{model_id}/inputs/upload")
async def upload_inputs(model_id: str, file: UploadFile, db: Session = Depends(get_db)):
    return dataset_service.upload_inputs(db, model_id, file)

@router.get("/{model_id}/datasets/{dataset_id}/tensors", response_model=List[TensorInfo])
def list_tensors(model_id: str, dataset_id: str, db: Session = Depends(get_db)):
    return dataset_service.get_tensors(db, model_id, dataset_id)

@router.get("/{model_id}/datasets/{dataset_id}/outputs")
def list_dataset_outputs(model_id: str, dataset_id: str, db: Session = Depends(get_db)):
    """
    List output files that are saved under the dataset directory, grouped by Run.
    """
    return dataset_service.get_dataset_outputs(db, model_id, dataset_id)
