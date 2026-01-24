
from typing import List
from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.dataset import Dataset, Tensor
from app.schemas.dataset import DatasetCreate, DatasetUpdate
from pydantic import BaseModel

class DatasetRepository(BaseRepository[Dataset, DatasetCreate, DatasetUpdate]):
    def get_by_model(self, db: Session, model_id: str) -> List[Dataset]:
        return db.query(self.model).filter(self.model.model_id == model_id).order_by(self.model.created_at.desc()).all()

class TensorRepository(BaseRepository[Tensor, BaseModel, BaseModel]):
    def get_by_dataset(self, db: Session, dataset_id: str) -> List[Tensor]:
        return db.query(self.model).filter(self.model.dataset_id == dataset_id).all()

dataset_repo = DatasetRepository(Dataset)
tensor_repo = TensorRepository(Tensor)
