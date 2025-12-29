import onnx
from google.protobuf.json_format import MessageToDict
from models import ModelMetaData, GraphNode, TensorSpec, ModelResponse, Opset
from utils.logger import setup_logger

logger = setup_logger("backend")

def _get_tensor_spec(value_info) -> TensorSpec:
    """Helper to extract shape and dtype from ValueInfoProto"""
    type_proto = value_info.type.tensor_type
    shape = []
    if type_proto.HasField("shape"):
        for dim in type_proto.shape.dim:
            if dim.HasField("dim_value"):
                shape.append(dim.dim_value)
            elif dim.HasField("dim_param"):
                # Dynamic dimension
                shape.append(None) # Or keep the param string? None is easier for JSON
            else:
                shape.append(None)
    
    # Mapping ONNX data types to string (simplified)
    # https://github.com/onnx/onnx/blob/main/onnx/onnx.proto#L487
    elem_type = type_proto.elem_type
    dtype_map = {
        1: "FLOAT", 2: "UINT8", 3: "INT8", 4: "UINT16", 5: "INT16",
        6: "INT32", 7: "INT64", 8: "STRING", 9: "BOOL", 11: "DOUBLE"
    }
    dtype_str = dtype_map.get(elem_type, "UNKNOWN")
    
    return TensorSpec(
        name=value_info.name,
        shape=shape,
        dtype=dtype_str
    )

def _convert_attribute(attr):
    """Convert ONNX attribute to python native type"""
    # Simply using MessageToDict for attributes as they vary a lot
    # Or implement custom extraction for common types like floats, ints, strings
    if attr.type == onnx.AttributeProto.FLOAT:
        return attr.f
    elif attr.type == onnx.AttributeProto.INT:
        return attr.i
    elif attr.type == onnx.AttributeProto.STRING:
        return attr.s.decode('utf-8')
    elif attr.type == onnx.AttributeProto.INTS:
        return list(attr.ints)
    elif attr.type == onnx.AttributeProto.FLOATS:
        return list(attr.floats)
    
    # Fallback
    return str(attr)

def parse_onnx_model(file_path: str, model_id: str, filename: str, session_id: str) -> ModelResponse:
    logger.info(f"Parsing ONNX model: {filename} ({model_id}) for session: {session_id}")
    # Load model structure only, ignoring missing external data files
    model = onnx.load(file_path, load_external_data=False)
    graph = model.graph
    
    node_count = len(graph.node)
    logger.info(f"Model loaded. Graph: {graph.name}, Nodes: {node_count}, IR Version: {model.ir_version}")
    
    # Collect all tensor shapes from inputs, value_info, and initializers
    tensor_shapes = {}
    
    # 1. Inputs
    for i in graph.input:
        spec = _get_tensor_spec(i)
        tensor_shapes[spec.name] = spec.shape
        
    # 2. Value Info (Intermediate tensors)
    for v in graph.value_info:
        spec = _get_tensor_spec(v)
        tensor_shapes[spec.name] = spec.shape
        
    # 3. Initializers (Constants/Weights)
    initializers = []
    for init in graph.initializer:
        tensor_shapes[init.name] = list(init.dims)
        initializers.append(init.name)

    # Nodes
    nodes = []
    for node in graph.node:
        attributes = {}
        for attr in node.attribute:
            attributes[attr.name] = _convert_attribute(attr)
            
        nodes.append(GraphNode(
            name=node.name,
            op_type=node.op_type,
            inputs=list(node.input),
            outputs=list(node.output),
            attributes=attributes
        ))
        
    # Meta
    meta = ModelMetaData(
        ir_version=model.ir_version,
        producer_name=model.producer_name,
        opset_import=[{"domain": op.domain, "version": op.version} for op in model.opset_import],
        graph_name=graph.name,
        inputs=[_get_tensor_spec(i) for i in graph.input],
        outputs=[_get_tensor_spec(o) for o in graph.output],
        tensor_shapes=tensor_shapes,
        initializers=initializers,
        session_id=session_id
    )
    
    import time
    return ModelResponse(
        id=model_id,
        filename=filename,
        upload_timestamp=time.time(),
        meta=meta,
        nodes=nodes
    )
