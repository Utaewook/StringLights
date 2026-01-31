
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class ModelBase(BaseModel):
    pass

class ModelCreate(ModelBase):
    pass

class ModelUpdate(ModelBase):
    pass

class TensorSpec(BaseModel):
    name: str
    shape: List[Optional[int]]
    dtype: str

class GraphNode(BaseModel):
    name: str
    op_type: str
    inputs: List[str]
    outputs: List[str]
    attributes: Dict[str, Any] = {}

class Opset(BaseModel):
    domain: str
    version: int

class ModelMetaData(BaseModel):
    ir_version: int
    producer_name: str
    opset_import: List[Opset]
    opset_version: Optional[int] = None
    graph_name: str
    inputs: List[TensorSpec]
    outputs: List[TensorSpec]
    tensor_shapes: Dict[str, List[Optional[int]]]
    initializers: List[str]
    session_id: str
    status: str = "READY"
    missing_files: List[str] = []

class ModelResponse(BaseModel):
    id: str
    filename: str
    upload_timestamp: float
    meta: ModelMetaData
    nodes: List[GraphNode]
