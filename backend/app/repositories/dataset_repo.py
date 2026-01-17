
from typing import List
from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.dataset import Dataset, Tensor

class DatasetRepository(BaseRepository[Dataset]):
    def get_by_model(self, db: Session, model_id: str) -> List[Dataset]:
        return db.query(self.model).filter(self.model.model_id == model_id).order_by(self.model.created_at.desc()).all()

class TensorRepository(BaseRepository[Tensor]):
    def get_by_dataset(self, db: Session, dataset_id: str) -> List[Tensor]:
        return db.query(self.model).filter(self.model.dataset_id == dataset_id).all()

dataset_repo = DatasetRepository(Dataset)
tensor_repo = TensorRepository(Tensor)
