import onnx
from onnx import helper

def run_graph_surgery(model_path: str, output_path: str) -> None:
    """
    Loads an ONNX model, runs shape inference, and appends all intermediate
    node outputs as graph outputs. This ensures the client can inspect 
    every intermediate computation result in the web visualizer.
    """
    # Load model
    model = onnx.load(model_path)
    
    # Run shape inference to populate graph.value_info
    try:
        inferred_model = onnx.shape_inference.infer_shapes(model)
    except Exception as e:
        # Fallback to the original model if shape inference fails
        print(f"Warning: ONNX shape inference failed, falling back: {str(e)}")
        inferred_model = model
    
    # Track existing outputs to prevent duplication
    existing_outputs = {out.name for out in inferred_model.graph.output}
    
    # Map inferred value_info by tensor name for quick retrieval
    value_info_map = {val.name: val for val in inferred_model.graph.value_info}
    
    # Append all node outputs that are not already in graph outputs
    for node in inferred_model.graph.node:
        for out_name in node.output:
            # Skip empty or already exported outputs
            if not out_name or out_name in existing_outputs:
                continue
            
            # If we have shape/type info from inference, append it directly
            if out_name in value_info_map:
                inferred_model.graph.output.append(value_info_map[out_name])
            else:
                # Create a fallback ValueInfo with undefined type/shape if inference missed it
                fallback_val_info = helper.make_tensor_value_info(
                    out_name,
                    onnx.TensorProto.UNDEFINED,
                    None
                )
                inferred_model.graph.output.append(fallback_val_info)
            
            # Add to set to prevent duplicate additions
            existing_outputs.add(out_name)
            
    # Save the modified model
    onnx.save(inferred_model, output_path)
