import onnx

def run_graph_surgery(model_path: str, output_path: str) -> None:
    """
    Loads an ONNX model, runs shape inference, and appends all intermediate
    tensors (value_info) as graph outputs so the client can inspect every node's output.
    """
    # Load model
    model = onnx.load(model_path)
    
    # Run shape inference to populate graph.value_info
    inferred_model = onnx.shape_inference.infer_shapes(model)
    
    # Track existing outputs to prevent duplication
    existing_outputs = {out.name for out in inferred_model.graph.output}
    
    # Add intermediate tensors as graph outputs
    for val_info in inferred_model.graph.value_info:
        if val_info.name not in existing_outputs:
            inferred_model.graph.output.append(val_info)
            existing_outputs.add(val_info.name)
            
    # Save the modified model
    onnx.save(inferred_model, output_path)
