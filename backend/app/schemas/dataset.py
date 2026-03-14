
from typing import List, Optional, Dict
from pydantic import BaseModel

class DatasetCreate(BaseModel):
    pass

class DatasetUpdate(BaseModel):
    pass

class InputGenerationRequest(BaseModel):
    name: Optional[str] = "Generated Input"
    dynamic_axes: Dict[str, int] = {} 

class TensorInfo(BaseModel):
    name: str # e.g. input_1
    tensor_name: str # e.g. input_1 (logic name)
    size_bytes: int
    filename: str
    shape: Optional[List[int]] = None
    dtype: Optional[str] = None
    statistics: Optional[Dict] = {}

class DatasetResponse(BaseModel):
    id: str
    name: str
    type: str
    created_at: float
