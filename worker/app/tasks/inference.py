
import os
import json
import numpy as np
import traceback
from celery import shared_task
from celery.utils.log import get_task_logger
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.run import Run
from app.engine.onnx_engine import OnnxInferenceEngine
from app.core.config import settings

logger = get_task_logger(__name__)

def save_json(path, data):
    # Custom serializer for numpy types
    def default(obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        raise TypeError

    with open(path, 'w') as f:
        json.dump(data, f, default=default, indent=2)

@shared_task(bind=True)
def execute_run(self, run_id: str):
    logger.info(f"Starting run {run_id}")
    db: Session = SessionLocal()
    
    try:
        # 1. Fetch Run Info
        run = db.query(Run).filter(Run.id == run_id).first()
        if not run:
            raise ValueError(f"Run {run_id} not found")
        
        # Run state update to RUNNING
        run.status = "RUNNING"
        db.commit()
        
        # 2. Paths
        model_path = os.path.join(settings.MODEL_DIR, str(run.model_id), "model.onnx")
        dataset_path = os.path.join(settings.DATA_DIR, str(run.model_id), str(run.dataset_id))
        
        run_dir = os.path.join(settings.RUN_DIR, str(run.model_id), run_id)
        os.makedirs(run_dir, exist_ok=True)
        
        # 3. Load Data
        # Assume bundle.npz exists from dataset generation
        bundle_path = os.path.join(dataset_path, "bundle.npz")
        if not os.path.exists(bundle_path):
             raise FileNotFoundError(f"Input bundle not found at {bundle_path}")
             
        data = np.load(bundle_path)
        # Convert npz to dict for feeding
        input_feed = {k: data[k] for k in data.files}
        
        # 4. Execute Inference
        engine = OnnxInferenceEngine()
        engine.load_model(model_path)
        result = engine.run(input_feed)
        
        # 5. Save Results
        # Trace Events
        save_json(os.path.join(run_dir, "trace.json"), result['trace_events'])
        
        # Tensor Stats
        save_json(os.path.join(run_dir, "stats.json"), result['tensor_stats'])
        
        # Metadata
        meta = {
            "status": "SUCCESS",
            "duration": result['metadata']['total_duration'],
            "executed_at": result['metadata']['timestamp']
        }
        save_json(os.path.join(run_dir, "meta.json"), meta)
        
        # 6. Update DB
        run.status = "COMPLETED"
        run.result_path = run_dir
        db.commit()
        
        logger.info(f"Run {run_id} completed successfully.")
        
    except Exception as e:
        logger.error(f"Run {run_id} failed: {e}")
        traceback.print_exc()
        
        if db:
            run.status = "FAILED"
            db.commit()
            
        # Optional: Save error log to file
    finally:
        db.close()
