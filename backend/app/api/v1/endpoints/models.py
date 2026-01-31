
from typing import List
from fastapi import APIRouter, UploadFile, Request, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.services.model_service import model_service
from app.schemas.model import ModelResponse

router = APIRouter()

@router.post("/upload", response_model=ModelResponse)
async def upload_model(files: List[UploadFile], request: Request, db: Session = Depends(get_db)):
    session_id = request.headers.get("X-Session-Id", "public")
    return model_service.upload_model(db, files, session_id)

@router.post("/{model_id}/upload_file", response_model=ModelResponse)
async def upload_model_file(model_id: str, files: List[UploadFile], request: Request, db: Session = Depends(get_db)):
    session_id = request.headers.get("X-Session-Id", "public")
    return model_service.upload_model_file(db, model_id, files, session_id)

@router.get("", response_model=List[ModelResponse])
def list_models(session_id: str = "public", db: Session = Depends(get_db)):
    return model_service.list_models(db, session_id)
