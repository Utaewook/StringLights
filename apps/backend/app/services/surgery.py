import onnx
from onnx import helper

# ─── ONNX elem_type → dtype string ───────────────────────────────────────────

ELEM_TYPE_TO_STR: dict[int, str] = {
    1:  "float32",
    2:  "uint8",
    3:  "int8",
    4:  "uint16",
    5:  "int16",
    6:  "int32",
    7:  "int64",
    8:  "string",
    9:  "bool",
    10: "float16",
    11: "float64",
    12: "uint32",
    13: "uint64",
}


def _get_tensor_meta(value_info) -> dict:
    """Extract dtype and shape from a ValueInfoProto."""
    type_proto = value_info.type
    if type_proto.HasField("tensor_type"):
        elem_type = type_proto.tensor_type.elem_type
        dtype = ELEM_TYPE_TO_STR.get(elem_type, "float32")
        shape_proto = type_proto.tensor_type.shape
        if shape_proto and len(shape_proto.dim) > 0:
            dims = []
            for dim in shape_proto.dim:
                if dim.HasField("dim_value") and dim.dim_value > 0:
                    dims.append(dim.dim_value)
                else:
                    dims.append(-1)  # dynamic or unknown dim
        else:
            dims = [-1]
        return {"dtype": dtype, "shape": dims}
    return {"dtype": "float32", "shape": [-1]}


def extract_graph_meta(model: onnx.ModelProto, original_output_names: list[str]) -> dict:
    """
    Extracts graph metadata (inputs, outputs, nodes) for the frontend visualizer.
    Returns a dict suitable for JSON serialisation.
    """
    graph = model.graph
    initializer_names = {init.name for init in graph.initializer}

    # Real model inputs (exclude weight initializers)
    inputs = []
    input_names = []
    for inp in graph.input:
        if inp.name and inp.name not in initializer_names:
            meta = _get_tensor_meta(inp)
            inputs.append({"name": inp.name, "shape": meta["shape"], "dtype": meta["dtype"]})
            input_names.append(inp.name)

    output_names = [out.name for out in graph.output if out.name]
    original_output_set = set(original_output_names)
    intermediate_output_names = [n for n in output_names if n not in original_output_set]

    nodes = []
    for idx, node in enumerate(graph.node):
        name = node.name or f"{node.op_type}_{idx}"
        nodes.append({
            "name": name,
            "opType": node.op_type,
            "inputs":  [i for i in node.input  if i],
            "outputs": [o for o in node.output if o],
        })

    return {
        "inputs":                   inputs,
        "inputNames":               input_names,
        "outputNames":              output_names,
        "originalOutputNames":      list(original_output_names),
        "intermediateOutputNames":  intermediate_output_names,
        "nodes":                    nodes,
    }


def run_graph_surgery(model_path: str, output_path: str) -> dict:
    """
    Loads an ONNX model, runs shape inference, and appends all intermediate
    node outputs as graph outputs so the client can inspect every activation.

    Returns a metadata dict for the frontend visualizer.
    """
    model = onnx.load(model_path)

    # Capture original output names before surgery
    original_output_names = [out.name for out in model.graph.output if out.name]

    # Shape inference (best-effort; fall back to original model on failure)
    try:
        inferred_model = onnx.shape_inference.infer_shapes(model)
    except Exception as e:
        print(f"Warning: ONNX shape inference failed, falling back: {e}")
        inferred_model = model

    # Build a lookup from tensor name → inferred ValueInfo
    existing_outputs = {out.name for out in inferred_model.graph.output}
    value_info_map   = {v.name: v for v in inferred_model.graph.value_info}

    # Append every intermediate node output that isn't already exported
    for node in inferred_model.graph.node:
        for out_name in node.output:
            if not out_name or out_name in existing_outputs:
                continue

            if out_name in value_info_map:
                inferred_model.graph.output.append(value_info_map[out_name])
            else:
                # Fallback: expose with undefined type/shape
                inferred_model.graph.output.append(
                    helper.make_tensor_value_info(
                        out_name,
                        onnx.TensorProto.UNDEFINED,
                        None,
                    )
                )
            existing_outputs.add(out_name)

    onnx.save(inferred_model, output_path)

    return extract_graph_meta(inferred_model, original_output_names)
