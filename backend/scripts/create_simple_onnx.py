
import onnx
from onnx import helper, TensorProto
import os

def create_model():
    # Define inputs and outputs
    input_info = helper.make_tensor_value_info('input', TensorProto.FLOAT, [None, 5])
    output_info = helper.make_tensor_value_info('output', TensorProto.FLOAT, [None, 2])
    
    # Create Nodes
    # Linear 1: 5 -> 10 -- We make weights as initializers
    w1 = helper.make_tensor('w1', TensorProto.FLOAT, [5, 10], [0.1]*50)
    b1 = helper.make_tensor('b1', TensorProto.FLOAT, [10], [0.1]*10)
    
    node_matmul1 = helper.make_node('Gemm', ['input', 'w1', 'b1'], ['fc1_out'], name='fc1')
    
    # ReLU
    node_relu = helper.make_node('Relu', ['fc1_out'], ['relu_out'], name='relu1')
    
    # Linear 2: 10 -> 2
    w2 = helper.make_tensor('w2', TensorProto.FLOAT, [10, 2], [0.1]*20)
    b2 = helper.make_tensor('b2', TensorProto.FLOAT, [2], [0.1]*2)
    
    node_matmul2 = helper.make_node('Gemm', ['relu_out', 'w2', 'b2'], ['output'], name='fc2')
    
    # Graph
    graph_def = helper.make_graph(
        [node_matmul1, node_relu, node_matmul2],
        'simple_net',
        [input_info],
        [output_info],
        [w1, b1, w2, b2]
    )
    
    # Model
    model_def = helper.make_model(graph_def, producer_name='string_lights_script')
    model_def.opset_import[0].version = 13
    
    # Save
    os.makedirs("bak/simple-model", exist_ok=True)
    output_path = "bak/simple-model/model.onnx"
    onnx.save(model_def, output_path)
    print(f"Model saved to {output_path}")

if __name__ == "__main__":
    create_model()
