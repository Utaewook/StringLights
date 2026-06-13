import os
import shutil
import tempfile
import unittest
import onnx
from onnx import helper, TensorProto
from app.services.surgery import run_graph_surgery

class TestSurgery(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.model_path = os.path.join(self.temp_dir, "toy_model.onnx")
        self.output_path = os.path.join(self.temp_dir, "modified_model.onnx")
        self._create_toy_model()
        
    def tearDown(self):
        shutil.rmtree(self.temp_dir)
        
    def _create_toy_model(self):
        # Create a toy model: X -> Add (with Y) -> Z -> Relu -> W
        # Inputs: X, Y
        # Outputs: W (original output)
        # Intermediate: Z (should be exposed by surgery)
        X = helper.make_tensor_value_info('X', TensorProto.FLOAT, [1, 2])
        Y = helper.make_tensor_value_info('Y', TensorProto.FLOAT, [1, 2])
        W = helper.make_tensor_value_info('W', TensorProto.FLOAT, [1, 2])
        
        node_add = helper.make_node('Add', ['X', 'Y'], ['Z'], name='node_add')
        node_relu = helper.make_node('Relu', ['Z'], ['W'], name='node_relu')
        
        graph = helper.make_graph(
            [node_add, node_relu],
            'toy_graph',
            [X, Y],
            [W]
        )
        
        model = helper.make_model(
            graph,
            producer_name='toy_producer',
            opset_imports=[helper.make_opsetid('', 17)]
        )
        onnx.save(model, self.model_path)
        
    def test_graph_surgery_adds_intermediates(self):
        # Run graph surgery
        run_graph_surgery(self.model_path, self.output_path, data_dir=self.temp_dir)
        
        # Load resulting ONNX model
        modified_model = onnx.load(self.output_path)
        
        # Verify both original output W and intermediate Z are present in outputs
        outputs = {out.name for out in modified_model.graph.output}
        self.assertIn('W', outputs)
        self.assertIn('Z', outputs)
        
        # Check that shape inference correctly populated Z's type and dimensions
        z_out = [out for out in modified_model.graph.output if out.name == 'Z'][0]
        self.assertEqual(z_out.type.tensor_type.elem_type, TensorProto.FLOAT)
        
        dims = [dim.dim_value for dim in z_out.type.tensor_type.shape.dim]
        self.assertEqual(dims, [1, 2])

if __name__ == '__main__':
    unittest.main()
