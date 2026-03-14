
import sys
import os
import shutil

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.session import SessionLocal, engine
from app.core.config import settings

def clean_data():
    # 1. Clear Database
    print("Cleaning database...")
    tables = ["runs", "tensors", "datasets", "models"]
    try:
        with engine.connect() as connection:
            for table in tables:
                result = connection.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE;"))
                print(f"Dropped table {table}")
            connection.commit()
    except Exception as e:
        print(f"Error cleaning database: {e}")
    
    # 2. Delete Directories (Content only)
    print("Cleaning local storage...")
    paths_to_clean = [settings.MODEL_DIR, settings.DATA_DIR, settings.RUN_DIR]
    
    for path in paths_to_clean:
        if os.path.exists(path):
            try:
                # Iterate over entries and delete them, keeping the root dir (mount point)
                for item in os.listdir(path):
                    item_path = os.path.join(path, item)
                    try:
                        if os.path.isfile(item_path) or os.path.islink(item_path):
                            os.unlink(item_path)
                        elif os.path.isdir(item_path):
                            shutil.rmtree(item_path)
                    except Exception as e:
                         print(f"Error deleting inner path {item_path}: {e}")
                print(f"Cleaned {path}")
            except Exception as e:
                print(f"Error cleaning directory {path}: {e}")
        else:
            # If it doesn't exist, create it (just in case)
            os.makedirs(path, exist_ok=True)
            print(f"Created {path}")

    print("Cleanup complete.")

if __name__ == "__main__":
    clean_data()
