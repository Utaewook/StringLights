
from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

class RunBase(BaseModel):
    model_id: UUID
    dataset_id: UUID

class RunCreate(RunBase):
    pass

class RunUpdate(BaseModel):
    status: Optional[str] = None
    output_path: Optional[str] = None

class Run(RunBase):
    id: UUID
    name: Optional[str] = None
    status: str
    output_path: Optional[str] = None
    metrics: Optional[dict] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
