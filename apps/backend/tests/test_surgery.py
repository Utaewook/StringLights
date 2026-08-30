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


class TestSubgraphSurfacing(unittest.TestCase):
    """Nodes inside If/Loop/Scan must reach the client, even unreadable."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.model_path = os.path.join(self.temp_dir, "control_flow.onnx")
        self.output_path = os.path.join(self.temp_dir, "modified.onnx")
        self._create_if_model()

    def tearDown(self):
        shutil.rmtree(self.temp_dir)

    def _create_if_model(self):
        # An If whose branches each hold one operator. A flat pass over
        # graph.node sees the If and nothing inside it.
        then_out = helper.make_tensor_value_info('then_out', TensorProto.FLOAT, [1])
        else_out = helper.make_tensor_value_info('else_out', TensorProto.FLOAT, [1])

        then_const = helper.make_node(
            'Constant', [], ['then_out'], name='then_const',
            value=helper.make_tensor('t', TensorProto.FLOAT, [1], [1.0]),
        )
        else_const = helper.make_node(
            'Constant', [], ['else_out'], name='else_const',
            value=helper.make_tensor('e', TensorProto.FLOAT, [1], [0.0]),
        )

        then_graph = helper.make_graph([then_const], 'then_body', [], [then_out])
        else_graph = helper.make_graph([else_const], 'else_body', [], [else_out])

        cond = helper.make_tensor_value_info('cond', TensorProto.BOOL, [1])
        result = helper.make_tensor_value_info('result', TensorProto.FLOAT, [1])
        if_node = helper.make_node(
            'If', ['cond'], ['result'], name='branch',
            then_branch=then_graph, else_branch=else_graph,
        )

        graph = helper.make_graph([if_node], 'control_flow', [cond], [result])
        onnx.save(
            helper.make_model(graph, opset_imports=[helper.make_opsetid('', 17)]),
            self.model_path,
        )

    def test_subgraph_nodes_reach_the_metadata(self):
        meta = run_graph_surgery(self.model_path, self.output_path, data_dir=self.temp_dir)

        names = {node['name'] for node in meta['nodes']}
        self.assertIn('branch', names, 'the If node itself is missing')
        self.assertIn('branch/then_branch/then_const', names)
        self.assertIn('branch/else_branch/else_const', names)
        self.assertEqual(meta['subgraphNodeCount'], 2)

    def test_subgraph_nodes_are_marked_uninspectable(self):
        meta = run_graph_surgery(self.model_path, self.output_path, data_dir=self.temp_dir)

        inner = [n for n in meta['nodes'] if n.get('subgraph')]
        self.assertEqual(len(inner), 2)
        for node in inner:
            self.assertFalse(node['inspectable'])

        outer = [n for n in meta['nodes'] if not n.get('subgraph')]
        self.assertTrue(all('inspectable' not in n for n in outer))

    def test_subgraph_tensor_names_are_scoped(self):
        """An unprefixed name would collide with the outer graph and rewire it."""
        meta = run_graph_surgery(self.model_path, self.output_path, data_dir=self.temp_dir)

        then_node = next(n for n in meta['nodes'] if n['name'].endswith('then_const'))
        self.assertEqual(then_node['outputs'], ['branch/then_branch/then_out'])

    def test_the_saved_model_still_passes_the_checker(self):
        run_graph_surgery(self.model_path, self.output_path, data_dir=self.temp_dir)
        onnx.checker.check_model(onnx.load(self.output_path))


class TestOutputPromotionSafety(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.model_path = os.path.join(self.temp_dir, "toy.onnx")
        self.output_path = os.path.join(self.temp_dir, "modified.onnx")

        X = helper.make_tensor_value_info('X', TensorProto.FLOAT, [1, 2])
        W = helper.make_tensor_value_info('W', TensorProto.FLOAT, [1, 2])
        graph = helper.make_graph(
            [helper.make_node('Relu', ['X'], ['W'], name='relu')], 'toy', [X], [W]
        )
        onnx.save(
            helper.make_model(graph, opset_imports=[helper.make_opsetid('', 17)]),
            self.model_path,
        )

    def tearDown(self):
        shutil.rmtree(self.temp_dir)

    def test_no_output_is_promoted_with_an_undefined_type(self):
        """UNDEFINED outputs are what onnxruntime stalls on — see issue 001."""
        run_graph_surgery(self.model_path, self.output_path, data_dir=self.temp_dir)

        model = onnx.load(self.output_path)
        for out in model.graph.output:
            self.assertNotEqual(
                out.type.tensor_type.elem_type,
                TensorProto.UNDEFINED,
                f'output {out.name} was promoted without a type',
            )

    def test_metadata_reports_what_could_not_be_promoted(self):
        meta = run_graph_surgery(self.model_path, self.output_path, data_dir=self.temp_dir)
        self.assertIn('unpromotableOutputNames', meta)
        self.assertIsInstance(meta['unpromotableOutputNames'], list)
