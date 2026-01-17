import os
import json
import uuid
from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models_orm import ModelORM, DatasetORM, TensorORM

# Environment variables
MODEL_DIR = os.environ.get("MODEL_DIR", "/model")
DATA_DIR = os.environ.get("DATA_DIR", "/data")

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
            # Validate UUID
            try:
                uuid_obj = uuid.UUID(model_id)
            except ValueError:
                print(f"Skipping non-UUID directory: {model_id}")
                continue

            # Check if exists in DB
            try:
                exists = db.query(ModelORM).filter(ModelORM.id == uuid_obj).first()
                if exists:
                    continue
                
                with open(meta_path, "r") as f:
                    data = json.load(f)
                    meta = data.get("meta", {})
                    
                    # Create ModelORM
                    model = ModelORM(
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
                    db.flush() # Force insert to check constraints
                    count += 1
            except Exception as e:
                db.rollback()
                print(f"Error syncing model {model_id}: {e}")
    
    db.commit()
    print(f"Synced {count} new models.")

def sync_datasets(db: Session):
    print("Syncing datasets...")
    # Iterate over models in DB to find their datasets
    models = db.query(ModelORM).all()
    
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
                    exists = db.query(DatasetORM).filter(DatasetORM.id == dataset_id).first()
                    if exists:
                        continue
                        
                    with open(meta_path, "r") as f:
                        data = json.load(f)
                        
                        dataset = DatasetORM(
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
                        
                        # Sync Tensors for this dataset
                        sync_tensors(db, dataset)
                except Exception as e:
                    db.rollback()
                    print(f"Error syncing dataset {dataset_id}: {e}")
                    
    db.commit()
    print(f"Synced {count} new datasets.")

def sync_tensors(db: Session, dataset: DatasetORM):
    # This assumes dataset.path_dir is accessible
    # Scan for .npy files
    import glob
    npy_files = glob.glob(os.path.join(dataset.path_dir, "*.npy"))
    
    for fpath in npy_files:
        try:
            fname = os.path.basename(fpath)
            tensor_name = fname.replace(".npy", "")
            
            # Check existence
            # Note: Checking every tensor might be slow, but this is a one-time sync script
            # Optimized: Just add, assume clean state if dataset is new
            
            tensor = TensorORM(
                dataset_id=dataset.id,
                name=tensor_name,
                filename=fname,
                size_bytes=os.path.getsize(fpath),
                dtype="float32", # Default, needs real inspection if critical
                shape=[] # Needs real inspection
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
