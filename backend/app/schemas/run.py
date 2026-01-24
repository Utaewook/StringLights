
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
    result_path: Optional[str] = None

class Run(RunBase):
    id: UUID
    status: str
    result_path: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
