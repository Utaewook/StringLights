
import onnx
import os
from app.schemas.model import ModelMetaData, GraphNode, TensorSpec, ModelResponse, Opset
from app.utils.logger import setup_logger

logger = setup_logger("backend.utils.onnx")

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
                shape.append(None) 
            else:
                shape.append(None)
    
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
    return str(attr)

def parse_onnx_model(file_path: str, model_id: str, filename: str, session_id: str) -> ModelResponse:
    logger.info(f"Parsing ONNX model: {filename} ({model_id}) for session: {session_id}")
    model = onnx.load(file_path, load_external_data=False)
    graph = model.graph
    
    # Check for missing external data
    base_dir = os.path.dirname(file_path)
    missing_files = set()
    
    # Check initializers
    for tensor in graph.initializer:
        if tensor.data_location == onnx.TensorProto.EXTERNAL:
            for entry in tensor.external_data:
                if entry.key == 'location':
                    # Validation: Simple existence check
                    # Sanitize path to prevent traversal? usually basename.
                    ext_filename = os.path.basename(entry.value)
                    ext_path = os.path.join(base_dir, ext_filename)
                    if not os.path.exists(ext_path):
                        missing_files.add(ext_filename)

    tensor_shapes = {}
    
    for i in graph.input:
        spec = _get_tensor_spec(i)
        tensor_shapes[spec.name] = spec.shape
        
    for v in graph.value_info:
        spec = _get_tensor_spec(v)
        tensor_shapes[spec.name] = spec.shape
        
    initializers = []
    for init in graph.initializer:
        tensor_shapes[init.name] = list(init.dims)
        initializers.append(init.name)

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
        
    opset_ver = None
    if model.opset_import:
        opset_ver = model.opset_import[0].version

    # Status determination
    status = "READY"
    if missing_files:
        status = "MISSING_FILES"

    meta = ModelMetaData(
        ir_version=model.ir_version,
        producer_name=model.producer_name,
        opset_import=[Opset(domain=op.domain, version=op.version) for op in model.opset_import],
        opset_version=opset_ver,
        graph_name=graph.name,
        inputs=[_get_tensor_spec(i) for i in graph.input],
        outputs=[_get_tensor_spec(o) for o in graph.output],
        tensor_shapes=tensor_shapes,
        initializers=initializers,
        session_id=session_id,
        # Extended Fields
        status=status,
        missing_files=list(missing_files)
    )
    
    import time
    return ModelResponse(
        id=model_id,
        filename=filename,
        upload_timestamp=time.time(),
        meta=meta,
        nodes=nodes
    )
