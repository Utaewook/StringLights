
import onnx
import onnxruntime as ort
import numpy as np
import time
from typing import Dict, Any, List
from .base import InferenceEngine

class OnnxInferenceEngine(InferenceEngine):
    def __init__(self):
        self.session = None
        self.model_path = None
        self.output_names = []
        self.input_names = []
        self.node_name_map = {} # output_name -> node_name mapping

    def load_model(self, model_path: str):
        self.model_path = model_path
        # Load ONNX model to get graph structure and node names
        model = onnx.load(model_path)
        
        # Build map to link tensor outputs back to producer nodes
        # This is strictly for visualization mapping
        for node in model.graph.node:
            for output in node.output:
                self.node_name_map[output] = node.name if node.name else f"{node.op_type}_{output}"

        # Setup Runtime Options
        sess_options = ort.SessionOptions()
        # Disable optimization to ensure we can trace all nodes for visualization
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_DISABLE_ALL
        # Enable profiling to get accurate node execution times if needed
        # sess_options.enable_profiling = True 
        
        self.session = ort.InferenceSession(model_path, sess_options, providers=['CPUExecutionProvider'])
        
        self.input_names = [i.name for i in self.session.get_inputs()]
        # To trace everything, we request all possible outputs that are graph nodes
        # Note: In a real complex model, this might be heavy. For demo, it's fine.
        # We need to filter out inputs from candidates.
        
        # Strategy: Get all outputs of all nodes from the ONNX graph definition
        all_intermediate_outputs = []
        for node in model.graph.node:
            for output in node.output:
                all_intermediate_outputs.append(output)
                
        # Register them as outputs for the session run
        self.output_names = list(set(all_intermediate_outputs))

    def _get_tensor_stats(self, tensor: np.ndarray) -> Dict[str, Any]:
        return {
            "shape": list(tensor.shape),
            "dtype": str(tensor.dtype),
            "min": float(np.min(tensor)) if tensor.size > 0 else 0,
            "max": float(np.max(tensor)) if tensor.size > 0 else 0,
            "mean": float(np.mean(tensor)) if tensor.size > 0 else 0,
        }

    def run(self, input_data: Dict[str, np.ndarray]) -> Dict[str, Any]:
        if not self.session:
            raise RuntimeError("Model not loaded")

        # Prepare inputs
        filtered_inputs = {k: v for k, v in input_data.items() if k in self.input_names}
        
        # Run inference requesting ALL intermediate outputs
        # We measure total time here. Granular execution control in ORT is hard without loop.
        # For simple animation, we can simulate 'duration' or rely on ORT profiling.
        # Here we will capture values and sequence.
        
        start_time = time.time()
        # Requesting all outputs allows us to "see" inside
        # Note: model_output_names should strictly be what the model *can* output.
        # Sometimes requesting internal tensors might fail in optimized graphs if they are fused.
        # Fallback: Just request model outputs? No, we need intermediate for lights.
        # We try to request all visible outputs.
        
        try:
            outputs = self.session.run(self.output_names, filtered_inputs)
        except Exception as e:
            # Fallback if optimization removed some nodes (fused)
            # We retry with only standard outputs
            print(f"Warning: Failed to trace all nodes, falling back to standard outputs. Error: {e}")
            final_outputs = [o.name for o in self.session.get_outputs()]
            outputs = self.session.run(final_outputs, filtered_inputs)
            self.output_names = final_outputs

        end_time = time.time()
        
        # Process results
        output_map = dict(zip(self.output_names, outputs))
        
        trace_events = []
        tensor_stats = {}
        
        # Naive ordering: We don't have exact execution order from ORT run()
        # But we can assume topological order from ONNX graph. 
        # For now, we return the data, and the frontend can play it sequentially 
        # based on the static graph structure or valid timestamps we might add later.
        
        # Collect stats
        for name, val in output_map.items():
            tensor_stats[name] = self._get_tensor_stats(val)
            
            # Create a mock event for triggering the node that produced this output
            node_name = self.node_name_map.get(name, f"Node_{name}")
            trace_events.append({
                "node_name": node_name,
                "output_tensor": name,
                "timestamp": end_time, # currently all happen at once effectively
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
