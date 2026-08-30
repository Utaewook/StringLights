import asyncio
import os
import shutil
import subprocess
import sys
import tempfile
import time
import unittest

import onnx
from onnx import TensorProto, helper

from app.services.isolation import (
    SurgeryFailed,
    SurgeryRejected,
    SurgeryTimeout,
    run_surgery_isolated,
)


def _toy_model(path: str, opset: int = 17) -> None:
    x = helper.make_tensor_value_info("X", TensorProto.FLOAT, [1, 2])
    y = helper.make_tensor_value_info("Y", TensorProto.FLOAT, [1, 2])
    graph = helper.make_graph(
        [helper.make_node("Relu", ["X"], ["Y"], name="relu")], "toy", [x], [y]
    )
    onnx.save(
        helper.make_model(graph, opset_imports=[helper.make_opsetid("", opset)]), path
    )


class TestSurgeryIsolation(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.model_path = os.path.join(self.temp_dir, "model.onnx")
        self.output_path = os.path.join(self.temp_dir, "modified.onnx")
        _toy_model(self.model_path)

    def tearDown(self):
        shutil.rmtree(self.temp_dir)

    async def _run(self, timeout_seconds: float = 60):
        return await run_surgery_isolated(
            self.model_path, self.output_path, self.temp_dir, timeout_seconds
        )

    async def test_returns_metadata_from_the_child(self):
        meta = await self._run()

        self.assertIn("nodes", meta)
        self.assertEqual(meta["opsetVersion"], 17)
        self.assertTrue(os.path.isfile(self.output_path))

    async def test_event_loop_stays_responsive_during_surgery(self):
        """The whole point of the child process: the server keeps answering.

        Called inline, surgery would hold the loop for its entire duration and
        this counter would barely move.
        """
        ticks = 0

        async def tick():
            nonlocal ticks
            while True:
                ticks += 1
                await asyncio.sleep(0.001)

        ticker = asyncio.create_task(tick())
        try:
            await self._run()
        finally:
            ticker.cancel()

        self.assertGreater(ticks, 5, "the event loop was blocked during surgery")

    async def test_timeout_kills_the_child_instead_of_waiting_for_it(self):
        started = time.monotonic()
        with self.assertRaises(SurgeryTimeout):
            # Too short for the child to finish importing onnx, let alone finish.
            await self._run(timeout_seconds=0.05)
        elapsed = time.monotonic() - started

        # An abandoned child would be collected by join(timeout=5) instead, so a
        # prompt return is the evidence that kill() actually landed.
        self.assertLess(elapsed, 3.0, "the child was abandoned rather than killed")

    async def test_a_rejected_model_keeps_its_explanation(self):
        _toy_model(self.model_path, opset=999)

        with self.assertRaises(SurgeryRejected) as caught:
            await self._run()

        self.assertIn("999", str(caught.exception))

    async def test_an_unexpected_failure_leaks_nothing(self):
        missing = os.path.join(self.temp_dir, "absent.onnx")

        with self.assertRaises(SurgeryFailed) as caught:
            await run_surgery_isolated(
                missing, self.output_path, self.temp_dir, timeout_seconds=60
            )

        message = str(caught.exception)
        self.assertNotIn(missing, message)
        self.assertNotIn("Traceback", message)
        self.assertNotIn("onnx", message.lower())


class TestParentStaysLean(unittest.TestCase):
    def test_importing_the_app_does_not_import_onnx(self):
        """onnx belongs to the child only.

        If it ever reaches the parent, every container carries the library's
        resident footprint for its whole life, on a host that has 512MB in
        total. This is a single import away from regressing, which is why it is
        asserted rather than documented.
        """
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "import app.main, sys; "
                "sys.exit(1 if 'onnx' in sys.modules else 0)",
            ],
            cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            capture_output=True,
        )

        self.assertEqual(
            result.returncode,
            0,
            f"app.main pulled onnx into the parent process. {result.stderr.decode()}",
        )


if __name__ == "__main__":
    unittest.main()
