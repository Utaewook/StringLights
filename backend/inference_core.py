import os
import numpy as np
import onnx
from typing import Dict, Any, List, Optional
from utils.logger import setup_logger

logger = setup_logger("backend")

def generate_dummy_inputs(model_path: str, dynamic_axes_values: Dict[str, int]) -> Dict[str, np.ndarray]:
    """
    Generate dummy numpy arrays for each input of the ONNX model.
    dynamic_axes_values: mapping of dimension parameter names (or None index) to size.
    """
    model = onnx.load(model_path, load_external_data=False)
    graph = model.graph
    
    inputs = {}
    for input_proto in graph.input:
        name = input_proto.name
        type_proto = input_proto.type.tensor_type
        
        shape = []
        for dim in type_proto.shape.dim:
            if dim.HasField("dim_value"):
                shape.append(dim.dim_value)
            elif dim.HasField("dim_param"):
                # Use provided value or default to 100
                val = dynamic_axes_values.get(dim.dim_param, 100)
                shape.append(val)
            else:
                # Unnamed dynamic dimension
                shape.append(100)
        
        # Mapping ONNX type to numpy type
        # For dummy data, we mostly care about float32 or int types
        elem_type = type_proto.elem_type
        if elem_type == onnx.TensorProto.FLOAT:
            data = np.random.randn(*shape).astype(np.float32)
        elif elem_type == onnx.TensorProto.DOUBLE:
            data = np.random.randn(*shape).astype(np.float64)
        elif elem_type in [onnx.TensorProto.INT32, onnx.TensorProto.INT64]:
            data = np.random.randint(0, 100, shape).astype(np.int64 if elem_type == onnx.TensorProto.INT64 else np.int32)
        else:
            data = np.random.randn(*shape).astype(np.float32)
            
        inputs[name] = data
        
    return inputs

def validate_npz_inputs(model_path: str, npz_path: str) -> bool:
    """
    Validate if the provided NPZ file matches the model's required inputs.
    """
    model = onnx.load(model_path, load_external_data=False)
    graph = model.graph
    
    with np.load(npz_path) as data:
        provided_names = set(data.files)
        required_inputs = []
        
        # Only consider graph.input that are NOT in graph.initializer (true model inputs)
        initializers = {i.name for i in graph.initializer}
        for i in graph.input:
            if i.name not in initializers:
                required_inputs.append(i.name)
        
        missing = [name for name in required_inputs if name not in provided_names]
        if missing:
            logger.error(f"Missing inputs in NPZ: {missing}")
            return False
            
        # Optional: check shapes (can be tricky with dynamic axes)
        return True

def save_inputs(save_dir: str, inputs: Dict[str, np.ndarray]):
    """
    Save each tensor as a separate .npy file using its input name as the filename.
    """
    os.makedirs(save_dir, exist_ok=True)
    paths = []
    for name, data in inputs.items():
        # Sanitize name to be a valid filename
        safe_name = "".join([c if c.isalnum() or c in "._-" else "_" for c in name])
        path = os.path.join(save_dir, f"{safe_name}.npy")
        np.save(path, data)
        paths.append(path)
        logger.info(f"Saved tensor '{name}' to {path}")
    
    # Also save a combined .npz for convenience if needed, but the requirement was individual files
    combined_path = os.path.join(save_dir, "inputs_combined.npz")
    np.savez(combined_path, **inputs)
    
    return save_dir # Return the directory containing the files
