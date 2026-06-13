import os
import shutil
import tempfile
import zipfile
import unittest
from fastapi.testclient import TestClient
import onnx
from onnx import helper, TensorProto
from app.main import app

class TestAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.temp_dir = tempfile.mkdtemp()
        
    def tearDown(self):
        shutil.rmtree(self.temp_dir)
        
    def _create_zip_with_onnx(self, onnx_filenames):
        # Create a simple valid toy graph: X -> Relu -> Y
        X = helper.make_tensor_value_info('X', TensorProto.FLOAT, [1, 2])
        Y = helper.make_tensor_value_info('Y', TensorProto.FLOAT, [1, 2])
        node = helper.make_node('Relu', ['X'], ['Y'], name='relu_node')
        
        graph = helper.make_graph(
            [node],
            'toy_graph',
            [X],
            [Y]
        )
        model = helper.make_model(graph, opset_imports=[helper.make_opsetid('', 17)])
        
        # Save ONNX models to temp files
        onnx_paths = []
        for filename in onnx_filenames:
            path = os.path.join(self.temp_dir, filename)
            onnx.save(model, path)
            onnx_paths.append(path)
            
        # Pack into a ZIP file
        zip_path = os.path.join(self.temp_dir, "test.zip")
        with zipfile.ZipFile(zip_path, "w") as z:
            for path, filename in zip(onnx_paths, onnx_filenames):
                z.write(path, arcname=filename)
        return zip_path

    def test_health_check(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "healthy"})
        
    def test_surgery_success(self):
        zip_path = self._create_zip_with_onnx(["model.onnx"])
        with open(zip_path, "rb") as f:
            response = self.client.post(
                "/api/surgery",
                files={"file": ("test.zip", f, "application/zip")},
                data={"perform_surgery": "true"}
            )
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "application/zip")
        
        # Extract response ZIP and verify content
        resp_zip_path = os.path.join(self.temp_dir, "response.zip")
        with open(resp_zip_path, "wb") as f:
            f.write(response.content)
            
        with zipfile.ZipFile(resp_zip_path, "r") as z:
            namelist = z.namelist()
            self.assertIn("model.onnx", namelist)
            self.assertIn("meta.json", namelist)

            # Verify meta.json has required fields
            import json
            meta = json.loads(z.read("meta.json"))
            self.assertIn("hadExternalData", meta)
            self.assertIn("opsetVersion", meta)
            self.assertFalse(meta["hadExternalData"])  # toy model has no external data
            self.assertGreater(meta["opsetVersion"], 0)
            
    def test_surgery_invalid_zip(self):
        bad_zip_path = os.path.join(self.temp_dir, "bad.zip")
        with open(bad_zip_path, "w") as f:
            f.write("not a zip file content")
            
        with open(bad_zip_path, "rb") as f:
            response = self.client.post(
                "/api/surgery",
                files={"file": ("bad.zip", f, "application/zip")},
                data={"perform_surgery": "true"}
            )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid ZIP", response.json()["detail"])
        
    def test_surgery_no_onnx(self):
        txt_path = os.path.join(self.temp_dir, "readme.txt")
        with open(txt_path, "w") as f:
            f.write("hello world")
            
        zip_path = os.path.join(self.temp_dir, "empty.zip")
        with zipfile.ZipFile(zip_path, "w") as z:
            z.write(txt_path, arcname="readme.txt")
            
        with open(zip_path, "rb") as f:
            response = self.client.post(
                "/api/surgery",
                files={"file": ("empty.zip", f, "application/zip")},
                data={"perform_surgery": "true"}
            )
        self.assertEqual(response.status_code, 400)
        self.assertIn("No ONNX model", response.json()["detail"])
        
    def test_surgery_multiple_onnx(self):
        zip_path = self._create_zip_with_onnx(["model1.onnx", "model2.onnx"])
        with open(zip_path, "rb") as f:
            response = self.client.post(
                "/api/surgery",
                files={"file": ("test.zip", f, "application/zip")},
                data={"perform_surgery": "true"}
            )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Multiple ONNX models found", response.json()["detail"])

if __name__ == '__main__':
    unittest.main()
