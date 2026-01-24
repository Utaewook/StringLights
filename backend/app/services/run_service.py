
from sqlalchemy.orm import Session
from app.repositories.run_repo import run_repo
from app.models.run import Run
from app.schemas.run import RunCreate
from app.core.celery_app import celery_app
import uuid
import os
import json
from app.core.config import settings

class RunService:
    @staticmethod
    def create_run(db: Session, run_in: RunCreate) -> Run:
        # Create DB Record (PENDING)
        db_obj = Run(
            id=uuid.uuid4(),
            model_id=run_in.model_id,
            dataset_id=run_in.dataset_id,
            status="PENDING"
        )
        run_repo.create(db, obj_in=db_obj)
        
        # Trigger Celery Task
        # Task name must match the one in worker
        celery_app.send_task("app.tasks.inference.execute_run", args=[str(db_obj.id)])
        
        return db_obj

    @staticmethod
    def get_run(db: Session, run_id: uuid.UUID) -> Run:
        return run_repo.get(db, run_id)

    @staticmethod
    def get_runs_by_model(db: Session, model_id: uuid.UUID):
        return run_repo.get_by_model(db, model_id)
        
    @staticmethod
    def get_run_trace(db: Session, run_id: uuid.UUID):
        run = run_repo.get(db, run_id)
        if not run or not run.result_path:
            return None
            
        trace_path = os.path.join(run.result_path, "trace.json")
        if os.path.exists(trace_path):
            with open(trace_path, 'r') as f:
                return json.load(f)
        return None

run_service = RunService()
