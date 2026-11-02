import asyncio
import os
import re
import shutil
import tempfile
import unittest
import zipfile
from unittest import mock

import onnx
from fastapi.testclient import TestClient
from onnx import TensorProto, helper

from app import main
from app.main import app
from app.metrics import QueueCounter, node_count_bucket, upload_mb_bucket
from app.services.isolation import SurgeryFailed, SurgeryRejected, SurgeryTimeout


def _fields(line: str) -> dict[str, str]:
    return dict(pair.split("=", 1) for pair in line.split())


class TestBuckets(unittest.TestCase):
    def test_upload_buckets(self):
        mb = 1024 * 1024
        self.assertEqual(upload_mb_bucket(10), "<1")
        self.assertEqual(upload_mb_bucket(3 * mb), "1-5")
        self.assertEqual(upload_mb_bucket(30 * mb), "25-50")
        self.assertEqual(upload_mb_bucket(60 * mb), ">=50")
        self.assertEqual(upload_mb_bucket(None), "unknown")

    def test_node_buckets(self):
        self.assertEqual(node_count_bucket(1), "<10")
        self.assertEqual(node_count_bucket(50), "50-199")
        self.assertEqual(node_count_bucket(5000), ">=1000")
        self.assertEqual(node_count_bucket(None), "unknown")


class TestQueueCounter(unittest.IsolatedAsyncioTestCase):
    async def test_waiting_rises_then_falls_after_acquire(self):
        sem, counter = asyncio.Semaphore(1), QueueCounter()
        await sem.acquire()
        task = asyncio.create_task(counter.acquire(sem))
        await asyncio.sleep(0)
        self.assertEqual(counter.waiting, 1)
        self.assertEqual(counter.depth_on_arrival(sem), 2)
        sem.release()
        await task
        self.assertEqual(counter.waiting, 0)

    async def test_waiting_falls_when_the_wait_is_cancelled(self):
        sem, counter = asyncio.Semaphore(1), QueueCounter()
        await sem.acquire()
        task = asyncio.create_task(counter.acquire(sem))
        await asyncio.sleep(0)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertEqual(counter.waiting, 0)

    async def test_waiting_falls_when_acquire_raises(self):
        counter = QueueCounter()
        broken = mock.Mock()
        broken.acquire = mock.AsyncMock(side_effect=RuntimeError("boom"))
        with self.assertRaises(RuntimeError):
            await counter.acquire(broken)
        self.assertEqual(counter.waiting, 0)


class TestSurgeryLog(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.tmp = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def _zip(self, members: dict[str, bytes], name="secret_name.zip") -> str:
        path = os.path.join(self.tmp, name)
        with zipfile.ZipFile(path, "w") as z:
            for member, data in members.items():
                z.writestr(member, data)
        return path

    def _model_bytes(self) -> bytes:
        x = helper.make_tensor_value_info("secret_tensor", TensorProto.FLOAT, [1, 2])
        y = helper.make_tensor_value_info("Y", TensorProto.FLOAT, [1, 2])
        node = helper.make_node("Relu", ["secret_tensor"], ["Y"], name="n")
        graph = helper.make_graph([node], "g", [x], [y])
        model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 17)])
        return model.SerializeToString()

    def _post(self, zip_path: str, upload_name="secret_name.zip"):
        with open(zip_path, "rb") as fh:
            return self.client.post(
                "/api/surgery", files={"file": (upload_name, fh, "application/zip")}
            )

    def _post_logged(self, zip_path: str, **kw):
        with self.assertLogs("app.metrics", level="INFO") as cm:
            response = self._post(zip_path, **kw)
        self.assertEqual(len(cm.output), 1)
        return response, _fields(cm.records[0].getMessage())

    def test_ok(self):
        response, f = self._post_logged(self._zip({"secret_model.onnx": self._model_bytes()}))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(f["event"], "surgery")
        self.assertEqual(f["outcome"], "ok")
        self.assertEqual(f["status"], "200")
        self.assertEqual(f["upload_mb_bucket"], "<1")
        self.assertEqual(f["node_count_bucket"], "<10")
        self.assertEqual(f["queue_depth_on_arrival"], "0")
        for key in ("queue_wait_ms", "surgery_ms", "total_ms"):
            self.assertGreaterEqual(int(f[key]), 0)
        self.assertGreaterEqual(int(f["total_ms"]), int(f["surgery_ms"]))

    def test_log_holds_no_names(self):
        _, f = self._post_logged(self._zip({"secret_model.onnx": self._model_bytes()}))
        line = " ".join(f"{k}={v}" for k, v in f.items())
        for word in ("secret", "Relu", ".onnx", ".zip", "127.0.0.1", "testclient"):
            self.assertNotIn(word, line)

    def test_rejected_without_onnx(self):
        response, f = self._post_logged(self._zip({"readme.txt": b"x"}))
        self.assertEqual((response.status_code, f["outcome"], f["status"]), (400, "rejected", "400"))

    def test_rejected_by_extension(self):
        path = self._zip({"a.onnx": b"x"}, name="a.txt")
        response, f = self._post_logged(path, upload_name="a.txt")
        self.assertEqual((response.status_code, f["outcome"]), (400, "rejected"))

    def test_rejected_by_surgery(self):
        with mock.patch.object(main, "run_surgery_isolated", side_effect=SurgeryRejected("no")):
            response, f = self._post_logged(self._zip({"m.onnx": b"x"}))
        self.assertEqual((response.status_code, f["outcome"]), (400, "rejected"))

    def test_bad_zip(self):
        path = os.path.join(self.tmp, "bad.zip")
        with open(path, "wb") as fh:
            fh.write(b"not a zip")
        response, f = self._post_logged(path, upload_name="bad.zip")
        self.assertEqual((response.status_code, f["outcome"]), (400, "bad_zip"))

    def test_too_large(self):
        with mock.patch.object(main, "MAX_FILE_SIZE", 10):
            response, f = self._post_logged(self._zip({"m.onnx": b"x" * 100}))
        self.assertEqual((response.status_code, f["outcome"], f["status"]), (400, "too_large", "400"))

    def test_too_large_at_the_middleware(self):
        with self.assertLogs("app.metrics", level="INFO") as cm:
            response = self.client.post(
                "/api/surgery",
                content=b"",
                headers={"content-length": str(main.MAX_REQUEST_BYTES + 1)},
            )
        f = _fields(cm.records[0].getMessage())
        self.assertEqual((response.status_code, f["outcome"], f["status"]), (413, "too_large", "413"))
        self.assertEqual(f["upload_mb_bucket"], ">=50")

    def test_timeout(self):
        with mock.patch.object(main, "run_surgery_isolated", side_effect=SurgeryTimeout("slow")):
            response, f = self._post_logged(self._zip({"m.onnx": b"x"}))
        self.assertEqual((response.status_code, f["outcome"], f["status"]), (504, "timeout", "504"))

    def test_failed_by_surgery(self):
        with mock.patch.object(main, "run_surgery_isolated", side_effect=SurgeryFailed("x")):
            response, f = self._post_logged(self._zip({"m.onnx": b"x"}))
        self.assertEqual((response.status_code, f["outcome"]), (500, "failed"))

    def test_failed_by_unexpected_error(self):
        with mock.patch.object(main, "run_surgery_isolated", side_effect=RuntimeError("x")):
            response, f = self._post_logged(self._zip({"m.onnx": b"x"}))
        self.assertEqual((response.status_code, f["outcome"]), (500, "failed"))
        self.assertEqual(main.queue_counter.waiting, 0)

    def test_the_semaphore_is_free_after_every_outcome(self):
        with mock.patch.object(main, "run_surgery_isolated", side_effect=RuntimeError("x")):
            self._post_logged(self._zip({"m.onnx": b"x"}))
        self.assertFalse(main.surgery_semaphore.locked())
        self.assertEqual(main.queue_counter.waiting, 0)


class TestAbandoned(unittest.IsolatedAsyncioTestCase):
    async def test_a_cancelled_request_logs_abandoned_and_frees_the_counter(self):
        class Upload:
            filename = "a.zip"
            file = tempfile.SpooledTemporaryFile()

        await main.surgery_semaphore.acquire()
        try:
            task = asyncio.create_task(
                main.perform_surgery(mock.Mock(), file=Upload(), perform_surgery=True)
            )
            await asyncio.sleep(0.05)
            self.assertEqual(main.queue_counter.waiting, 1)
            with self.assertLogs("app.metrics", level="INFO") as cm:
                task.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await task
        finally:
            main.surgery_semaphore.release()
        f = _fields(cm.records[0].getMessage())
        self.assertEqual((f["outcome"], f["status"]), ("abandoned", "499"))
        self.assertEqual(f["queue_depth_on_arrival"], "1")
        self.assertEqual(main.queue_counter.waiting, 0)
        self.assertEqual(os.listdir(main.TEMP_ROOT), [])


if __name__ == "__main__":
    unittest.main()
