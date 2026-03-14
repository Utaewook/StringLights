
from sqlalchemy.orm import Session
from app.repositories.run_repo import run_repo
from app.repositories.dataset_repo import dataset_repo
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
        # Generate Name
        dataset = dataset_repo.get(db, run_in.dataset_id)
        dataset_name = dataset.name if dataset else "unknown"
        
        # Count existing runs for this combo
        count = db.query(Run).filter(
            Run.model_id == run_in.model_id,
            Run.dataset_id == run_in.dataset_id
        ).count()
        
        run_name = f"{dataset_name}_{count}"

        # Create DB Record (PENDING)
        db_obj = Run(
            id=uuid.uuid4(),
            model_id=run_in.model_id,
            dataset_id=run_in.dataset_id,
            name=run_name,
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
        if not run or not run.output_path: # Changed result_path to output_path generally, checking model
            return None
            
        trace_path = os.path.join(run.output_path, "trace.json")
        if os.path.exists(trace_path):
            with open(trace_path, 'r') as f:
                return json.load(f)
        return None

    @staticmethod
    def list_runs(db: Session, model_id: uuid.UUID = None, dataset_id: uuid.UUID = None) -> list[Run]:
        # Minimal filtering - ideally move to repo
        query = db.query(Run)
        if model_id:
            query = query.filter(Run.model_id == model_id)
        if dataset_id:
            query = query.filter(Run.dataset_id == dataset_id)
        return query.order_by(Run.start_time.desc()).all()

    @staticmethod
    def get_run_outputs(db: Session, run_id: uuid.UUID) -> list[dict]:
        run = run_repo.get(db, run_id)
        if not run or not run.output_path or not os.path.exists(run.output_path):
            return []
            
        outputs = []
        for f in os.listdir(run.output_path):
            if f.endswith(".npy"):
                path = os.path.join(run.output_path, f)
                size = os.path.getsize(path)
                outputs.append({
                    "name": f,
                    "size_bytes": size,
                    "filename": f
                })
        return outputs

run_service = RunService()
