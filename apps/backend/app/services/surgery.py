import os
import onnx
from onnx import helper
from onnx.external_data_helper import load_external_data_for_model

# ─── Constants ────────────────────────────────────────────────────────────────

SUPPORTED_OPSET_RANGE = (7, 21)

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


# ─── Helpers ──────────────────────────────────────────────────────────────────

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


def get_opset_version(model: onnx.ModelProto) -> int:
    """Returns the default ONNX domain opset version. Falls back to 1."""
    for opset in model.opset_import:
        if opset.domain in ("", "ai.onnx"):
            return opset.version
    return 1


def check_opset_version(model: onnx.ModelProto) -> int:
    """
    Validates that the model opset is within the supported range.
    Raises ValueError with a clear message if out of range.
    Returns the opset version integer.
    """
    version = get_opset_version(model)
    lo, hi = SUPPORTED_OPSET_RANGE
    if not (lo <= version <= hi):
        raise ValueError(
            f"Unsupported ONNX opset version: {version}. "
            f"Supported range is opset {lo}–{hi}."
        )
    return version


def has_external_data_references(model: onnx.ModelProto) -> bool:
    """
    Returns True if any initializer tensor is stored as external data.
    This is the case for models exported with save_as_external_data=True.
    """
    for initializer in model.graph.initializer:
        if initializer.data_location == onnx.TensorProto.EXTERNAL:
            return True
    return False


# ─── Metadata extraction ──────────────────────────────────────────────────────

def extract_graph_meta(
    model: onnx.ModelProto,
    original_output_names: list[str],
    had_external_data: bool = False,
    opset_version: int = 0,
) -> dict:
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
        
        attributes = {}
        for attr in node.attribute:
            if attr.type == onnx.AttributeProto.FLOAT:
                attributes[attr.name] = attr.f
            elif attr.type == onnx.AttributeProto.INT:
                attributes[attr.name] = attr.i
            elif attr.type == onnx.AttributeProto.STRING:
                attributes[attr.name] = attr.s.decode('utf-8', 'ignore')
            elif attr.type == onnx.AttributeProto.INTS:
                attributes[attr.name] = list(attr.ints)
            elif attr.type == onnx.AttributeProto.FLOATS:
                attributes[attr.name] = list(attr.floats)
            elif attr.type == onnx.AttributeProto.STRINGS:
                attributes[attr.name] = [s.decode('utf-8', 'ignore') for s in attr.strings]
            else:
                attributes[attr.name] = "<unsupported type>"

        nodes.append({
            "name":       name,
            "opType":     node.op_type,
            "inputs":     [i for i in node.input  if i],
            "outputs":    [o for o in node.output if o],
            "attributes": attributes,
        })

    return {
        "inputs":                   inputs,
        "inputNames":               input_names,
        "outputNames":              output_names,
        "originalOutputNames":      list(original_output_names),
        "intermediateOutputNames":  intermediate_output_names,
        "nodes":                    nodes,
        "hadExternalData":          had_external_data,
        "opsetVersion":             opset_version,
    }


# ─── Main surgery entrypoint ──────────────────────────────────────────────────

def run_graph_surgery(model_path: str, output_path: str, data_dir: str) -> dict:
    """
    Loads an ONNX model, validates opset + external data requirements,
    runs shape inference, appends all intermediate node outputs as graph
    outputs so the client can inspect every activation, and saves the result
    as a single inlined .onnx file (no external data dependencies).

    Args:
        model_path:  Absolute path to the input .onnx file.
        output_path: Absolute path where the modified .onnx will be written.
        data_dir:    Directory containing any companion .onnx.data files.

    Returns:
        A metadata dict for the frontend visualizer (JSON-serialisable).

    Raises:
        ValueError: for opset violations or missing external data files.
    """
    # ── Step 1: Load graph structure only (fast, no data) for early checks ──
    model_stub = onnx.load(model_path, load_external_data=False)

    # ── Step 2: Opset version gate ──────────────────────────────────────────
    opset_version = check_opset_version(model_stub)   # raises ValueError if out of range

    # ── Step 3: External data detection and loading ─────────────────────────
    had_external_data = has_external_data_references(model_stub)

    if had_external_data:
        # Confirm companion data file(s) are present in data_dir
        data_files = [
            f for f in os.listdir(data_dir)
            if not f.lower().endswith(".onnx")
        ]
        if not data_files:
            raise ValueError(
                "This model requires an external data file (.onnx.data). "
                "Please re-upload both the .onnx and .onnx.data files together."
            )
        # Load tensor weights from disk into in-memory TensorProto objects
        # (changes data_location from EXTERNAL → DEFAULT and fills raw_data)
        load_external_data_for_model(model_stub, os.path.dirname(model_path))
        model = model_stub
    else:
        # Re-load cleanly (separates stub read from full load path)
        model = onnx.load(model_path, load_external_data=False)

    # ── Step 4: Capture original output names before surgery ─────────────────
    original_output_names = [out.name for out in model.graph.output if out.name]

    # ── Step 5: Shape inference (best-effort) ────────────────────────────────
    try:
        inferred_model = onnx.shape_inference.infer_shapes(model)
    except Exception as e:
        print(f"Warning: ONNX shape inference failed, falling back to original graph: {e}")
        inferred_model = model

    # ── Step 6: Append intermediate node outputs ──────────────────────────────
    existing_outputs = {out.name for out in inferred_model.graph.output}
    value_info_map   = {v.name: v for v in inferred_model.graph.value_info}

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

    # ── Step 7: Save as single inlined .onnx (no external data) ──────────────
    # When had_external_data=True, load_external_data_for_model already moved
    # all tensor data into memory (data_location=DEFAULT), so onnx.save writes
    # everything into one file by default.
    onnx.save(inferred_model, output_path)

    # ── Step 8: Return metadata for frontend ──────────────────────────────────
    return extract_graph_meta(
        inferred_model,
        original_output_names,
        had_external_data=had_external_data,
        opset_version=opset_version,
    )
