
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.api import deps
from app.schemas.run import Run, RunCreate
from app.services.run_service import run_service

router = APIRouter()

@router.post("/", response_model=Run)
def create_run(
    item: RunCreate,
    db: Session = Depends(deps.get_db)
):
    """
    Create a new inference run.
    Triggers an async task on the worker.
    """
    return run_service.create_run(db, item)

@router.get("/{run_id}", response_model=Run)
def get_run(
    run_id: UUID,
    db: Session = Depends(deps.get_db)
):
    run = run_service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run

@router.get("/{run_id}/trace")
def get_run_trace(
    run_id: UUID,
    db: Session = Depends(deps.get_db)
):
    """
    Get the trace data (visualization events) for a completed run.
    """
    trace = run_service.get_run_trace(db, run_id)
    if not trace:
        raise HTTPException(status_code=404, detail="Trace data not found or run not completed")
    return trace
