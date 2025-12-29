from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel

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
    graph_name: str
    inputs: List[TensorSpec]
    outputs: List[TensorSpec]
    tensor_shapes: dict[str, list[Optional[int]]]
    initializers: List[str] # List of names of tensors that are initializers (weights/bias)
    session_id: str
    
class ModelResponse(BaseModel):
    id: str
    filename: str
    upload_timestamp: float
    meta: ModelMetaData
    nodes: List[GraphNode]
