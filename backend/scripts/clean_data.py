
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
    print("WARNING: This will delete ALL data in the database and local storage.")
    confirm = input("Are you sure? (y/n): ")
    if confirm.lower() != 'y':
        print("Aborted.")
        return

    # 1. Truncate Tables
    # Need to handle foreign keys. CASCADE is usually best.
    # Postgres specific
    print("Cleaning database...")
    try:
        with engine.connect() as connection:
            connection.execute(text("TRUNCATE TABLE runs, tensors, datasets, models CASCADE;"))
            connection.commit()
    except Exception as e:
        print(f"Error truncating tables: {e}")
        # Fallback: Delete via ORM if truncate fails (e.g., permissions)
        # But Truncate is faster/cleaner.
    
    # 2. Delete Directories
    print("Cleaning local storage...")
    paths_to_clean = [settings.MODEL_DIR, settings.DATA_DIR]
    
    for path in paths_to_clean:
        if os.path.exists(path):
            try:
                shutil.rmtree(path)
                print(f"Deleted {path}")
            except Exception as e:
                print(f"Error deleting {path}: {e}")
        
        # Recreate empty dir
        os.makedirs(path, exist_ok=True)
        print(f"Recreated {path}")

    print("Cleanup complete.")

if __name__ == "__main__":
    clean_data()
