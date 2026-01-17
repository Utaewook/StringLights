
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import uuid
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.model import Model
from app.models.dataset import Dataset, Tensor
from app.core.config import settings

# Environment variables
MODEL_DIR = settings.MODEL_DIR
DATA_DIR = settings.DATA_DIR

def sync_models(db: Session):
    print("Syncing models...")
    if not os.path.exists(MODEL_DIR):
        print(f"Model directory {MODEL_DIR} does not exist.")
        return

    count = 0
    for model_id in os.listdir(MODEL_DIR):
        model_path = os.path.join(MODEL_DIR, model_id)
        meta_path = os.path.join(model_path, "meta.json")
        
        if os.path.isdir(model_path) and os.path.exists(meta_path):
            try:
                uuid_obj = uuid.UUID(model_id)
            except ValueError:
                print(f"Skipping non-UUID directory: {model_id}")
                continue

            try:
                exists = db.query(Model).filter(Model.id == uuid_obj).first()
                if exists:
                    continue
                
                with open(meta_path, "r") as f:
                    data = json.load(f)
                    meta = data.get("meta", {})
                    
                    model = Model(
                        id=uuid_obj,
                        session_id=meta.get("session_id", "public"),
                        filename=data.get("filename", "unknown.onnx"),
                        path_files=model_path,
                        filesize_bytes=os.path.getsize(os.path.join(model_path, "model.onnx")),
                        ir_version=meta.get("ir_version"),
                        opset_version=meta.get("opset_version"),
                        graph_name=meta.get("graph_name"),
                        meta_info=data
                    )
                    db.add(model)
                    db.flush()
                    count += 1
            except Exception as e:
                db.rollback()
                print(f"Error syncing model {model_id}: {e}")
    
    db.commit()
    print(f"Synced {count} new models.")

def sync_datasets(db: Session):
    print("Syncing datasets...")
    models = db.query(Model).all()
    
    count = 0
    for model in models:
        model_id = str(model.id)
        model_data_dir = os.path.join(DATA_DIR, model_id)
        
        if not os.path.exists(model_data_dir):
            continue
            
        for dataset_id in os.listdir(model_data_dir):
            dataset_path = os.path.join(model_data_dir, dataset_id)
            meta_path = os.path.join(dataset_path, "dataset_meta.json")
            
            if os.path.isdir(dataset_path) and os.path.exists(meta_path):
                try:
                    exists = db.query(Dataset).filter(Dataset.id == dataset_id).first()
                    if exists:
                        continue
                        
                    with open(meta_path, "r") as f:
                        data = json.load(f)
                        
                        dataset = Dataset(
                            id=uuid.UUID(dataset_id),
                            model_id=model.id,
                            name=data.get("name", "Unnamed"),
                            type=data.get("type", "Manual"),
                            path_dir=dataset_path,
                            meta_info=data
                        )
                        db.add(dataset)
                        db.flush()
                        count += 1
                        
                        sync_tensors(db, dataset)
                except Exception as e:
                    db.rollback()
                    print(f"Error syncing dataset {dataset_id}: {e}")
                    
    db.commit()
    print(f"Synced {count} new datasets.")

def sync_tensors(db: Session, dataset: Dataset):
    import glob
    npy_files = glob.glob(os.path.join(dataset.path_dir, "*.npy"))
    
    for fpath in npy_files:
        try:
            fname = os.path.basename(fpath)
            tensor_name = fname.replace(".npy", "")
            
            tensor = Tensor(
                dataset_id=dataset.id,
                name=tensor_name,
                filename=fname,
                size_bytes=os.path.getsize(fpath),
                dtype="float32",
                shape=[]
            )
            db.add(tensor)
        except Exception as e:
            print(f"Error syncing tensor {fname}: {e}")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        sync_models(db)
        sync_datasets(db)
    finally:
        db.close()
