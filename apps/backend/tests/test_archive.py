import os
import shutil
import tempfile
import unittest
import zipfile

from app.services.archive import (
    MAX_EXTRACTED_TOTAL,
    MAX_ONNX_FILE,
    ArchiveRejected,
    extract_bounded,
)


def _write_incompressible_zeros(zip_path: str, name: str, megabytes: int) -> None:
    """Build an archive that expands to `megabytes` without ever holding it.

    Allocating the payload up front would OOM the very container these tests run
    in, which would look like a failure of the code under test.
    """
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as archive:
        with archive.open(name, "w") as member:
            chunk = b"\0" * (1024 * 1024)
            for _ in range(megabytes):
                member.write(chunk)


class TestBoundedExtraction(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.dest = os.path.join(self.temp_dir, "dest")
        os.makedirs(self.dest)

    def tearDown(self):
        shutil.rmtree(self.temp_dir)

    def _zip(self, name: str) -> str:
        return os.path.join(self.temp_dir, name)

    def test_extracts_a_flat_archive_byte_for_byte(self):
        path = self._zip("flat.zip")
        with zipfile.ZipFile(path, "w") as z:
            z.writestr("model.onnx", b"x" * 4096)
            z.writestr("model.onnx.data", b"y" * 8192)

        extract_bounded(path, self.dest)

        self.assertEqual(sorted(os.listdir(self.dest)), ["model.onnx", "model.onnx.data"])
        with open(os.path.join(self.dest, "model.onnx"), "rb") as f:
            self.assertEqual(f.read(), b"x" * 4096)

    def test_preserves_nested_paths(self):
        path = self._zip("nested.zip")
        with zipfile.ZipFile(path, "w") as z:
            z.writestr("sub/model.onnx", b"x" * 16)

        extract_bounded(path, self.dest)

        self.assertTrue(os.path.isfile(os.path.join(self.dest, "sub", "model.onnx")))

    def test_refuses_a_member_that_escapes_the_destination(self):
        path = self._zip("slip.zip")
        with zipfile.ZipFile(path, "w") as z:
            z.writestr("../../escaped.txt", b"pwned")

        with self.assertRaises(ArchiveRejected):
            extract_bounded(path, self.dest)

        # Writing members by hand loses the sanitising extractall does for free,
        # so this asserts on the filesystem, not just on the exception.
        self.assertFalse(os.path.exists(os.path.join(self.temp_dir, "escaped.txt")))

    def test_refuses_a_zip_bomb_before_writing_anything(self):
        path = self._zip("bomb.zip")
        _write_incompressible_zeros(path, "payload.bin", 200)
        self.assertLess(os.path.getsize(path), 1024 * 1024, "bomb did not compress")

        with self.assertRaises(ArchiveRejected):
            extract_bounded(path, self.dest)

        self.assertEqual(os.listdir(self.dest), [], "wrote to disk before rejecting")

    def test_refuses_an_onnx_file_over_the_per_model_limit(self):
        # Under the archive total, over the model ceiling — the limit that keeps
        # surgery's in-memory peak inside the container.
        megabytes = (MAX_ONNX_FILE // (1024 * 1024)) + 20
        self.assertLess(megabytes * 1024 * 1024, MAX_EXTRACTED_TOTAL)

        path = self._zip("fat_model.zip")
        _write_incompressible_zeros(path, "model.onnx", megabytes)

        with self.assertRaises(ArchiveRejected) as caught:
            extract_bounded(path, self.dest)

        self.assertIn("ONNX model", str(caught.exception))
        self.assertEqual(os.listdir(self.dest), [])


if __name__ == "__main__":
    unittest.main()
