
from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.run import Run
from app.schemas.run import RunCreate, RunUpdate

class RunRepository(BaseRepository[Run, RunCreate, RunUpdate]):
    def get_by_model(self, db: Session, model_id: str):
        return db.query(self.model).filter(self.model.model_id == model_id).all()

run_repo = RunRepository(Run)
