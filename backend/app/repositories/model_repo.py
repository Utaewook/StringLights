
from typing import List, Optional
from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.model import Model

class ModelRepository(BaseRepository[Model]):
    def get_by_session(self, db: Session, session_id: str) -> List[Model]:
        return db.query(self.model).filter(self.model.session_id == session_id).order_by(self.model.created_at.desc()).all()

model_repo = ModelRepository(Model)
