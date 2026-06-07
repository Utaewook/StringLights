import onnx
import onnxruntime as ort
import numpy as np
import time
import os
from typing import Dict, Any, List
from .base import InferenceEngine

class OnnxInferenceEngine(InferenceEngine):
    def __init__(self):
        self.session = None
        self.model_path = None
        self.output_names = []
        self.input_names = []
        self.tensor_to_node = {} # tensor_name -> {name, op_type}

    def load_model(self, model_path: str):
        self.model_path = model_path
        # 1. Load original model
        model = onnx.load(model_path)
        
        # 2. Instrument Model: Name nodes/tensors and promote all to outputs
        instrumented_model = self._instrument_model(model)
        
        # 3. Setup Runtime Options
        sess_options = ort.SessionOptions()
        # Optimization MUST be disabled to keep the instrumented graph structure intact
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_DISABLE_ALL
        
        # Load the instrumented model from bytes
        model_bytes = instrumented_model.SerializeToString()
        self.session = ort.InferenceSession(model_bytes, sess_options, providers=['CPUExecutionProvider'])
        
        # 4. Map outputs for tracing
        self.input_names = [i.name for i in self.session.get_inputs()]
        # The instrumented model now has all node outputs as graph outputs
        self.output_names = [o.name for o in self.session.get_outputs()]
        
        # Build map: tensor_name -> node_info for easy trace generation
        self.tensor_to_node = {} # tensor_name -> {name, op_type}
        for node in instrumented_model.graph.node:
            for output in node.output:
                self.tensor_to_node[output] = {
                    "name": node.name,
                    "op_type": node.op_type
                }

    def _instrument_model(self, model: onnx.ModelProto) -> onnx.ModelProto:
        """
        Names anonymous nodes/tensors and adds ALL intermediate tensors as graph outputs
        to ensure they are fetchable by ORT.
        """
        graph = model.graph
        
        # 1. Name anonymous nodes/tensors
        for i, node in enumerate(graph.node):
            if not node.name:
                node.name = f"unnamed_node_{i}_{node.op_type}"
            
            for j, output in enumerate(node.output):
                if not output:
                    # Create a deterministic name for unnamed output tensors
                    # Using node name + index is safe
                    new_output_name = f"{node.name}_out_{j}"
                    node.output[j] = new_output_name
        
        # 2. Collect all produced tensors
        all_produces = []
        for node in graph.node:
            for out in node.output:
                all_produces.append(out)
        
        # 3. Prevent duplicate outputs (already in graph.output)
        existing_outputs = {o.name for o in graph.output}
        
        # 4. Add all produced tensors as outputs
        for tensor_name in all_produces:
            if tensor_name not in existing_outputs:
                # Add as an output
                new_output = graph.output.add()
                new_output.name = tensor_name
        
        # 5. Run shape inference to populate TypeProto/Shape for the new outputs
        # ORT requires outputs to have valid definitions
        try:
            model = onnx.shape_inference.infer_shapes(model)
        except Exception as e:
            # We log but continue, ORT might still work if types can be inferred at runtime
            print(f"Warning: Shape inference failed during instrumentation: {e}")
            
        return model

    def _get_tensor_stats(self, tensor: np.ndarray) -> Dict[str, Any]:
        if not isinstance(tensor, np.ndarray):
            tensor = np.array(tensor)
            
        # Basic stats for visualization
        stats = {
            "shape": list(tensor.shape),
            "dtype": str(tensor.dtype),
        }
        
        if tensor.size > 0:
            try:
                stats.update({
                    "min": float(np.min(tensor)),
                    "max": float(np.max(tensor)),
                    "mean": float(np.mean(tensor)),
                })
            except:
                # For non-numeric dtypes (bool, etc.)
                stats.update({"min": 0, "max": 0, "mean": 0})
        else:
            stats.update({"min": 0, "max": 0, "mean": 0})
            
        return stats

    def run(self, input_data: Dict[str, np.ndarray]) -> Dict[str, Any]:
        if not self.session:
            raise RuntimeError("Model not loaded")

        # Prepare inputs
        filtered_inputs = {k: v for k, v in input_data.items() if k in self.input_names}
        
        start_time = time.time()
        
        # Run inference - No fallback needed anymore because all outputs are explicitly defined
        try:
            outputs = self.session.run(self.output_names, filtered_inputs)
        except Exception as e:
            raise RuntimeError(f"Inference failed even after instrumentation: {e}")

        end_time = time.time()
        
        # Process results
        output_map = dict(zip(self.output_names, outputs))
        
        trace_events = []
        tensor_stats = {}
        
        # Collect stats and generate events
        for name, val in output_map.items():
            stats = self._get_tensor_stats(val)
            tensor_stats[name] = stats
            
            # Map back to node
            node_info = self.tensor_to_node.get(name)
            if node_info:
                trace_events.append({
                    "node_name": node_info["name"],
                    "op_type": node_info["op_type"],
                    "output_tensor": name,
                    "timestamp": end_time,
                    "duration": 0
                })

        return {
            "metadata": {
                "total_duration": end_time - start_time,
                "timestamp": start_time
            },
            "trace_events": trace_events,
            "tensor_stats": tensor_stats,
            "outputs": output_map
        }
