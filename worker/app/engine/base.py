
from abc import ABC, abstractmethod
from typing import Dict, Any, List

class InferenceEngine(ABC):
    @abstractmethod
    def load_model(self, model_path: str):
        pass

    @abstractmethod
    def run(self, input_feed: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes inference and returns the trace data.
        Trace data should include:
        - execution_trace: List of executed nodes with timing
        - tensor_stats: Statistics of intermediate tensors
        - outputs: Model final outputs
        """
        pass
