"""Bounded ZIP extraction.

A 50MB upload says nothing about what it becomes on disk. ONNX weights compress
well, so a well-formed archive inside the upload cap can expand to several
hundred megabytes — enough to fill the disk, and once loaded, enough to
OOM-kill a 350M container.

Both limits below are enforced twice. The header pass is cheap and rejects the
honest oversized model — and the classic zip bomb — before a single byte is
written. The measured pass counts what actually lands on disk, because a header
is attacker-controlled.

The measured pass is defence in depth rather than the primary guard: CPython's
`zipfile` truncates each member read at its declared `file_size`, so a header
that understates its member currently surfaces as a CRC failure before the byte
count can be exceeded. That is an implementation detail of the standard library,
not a guarantee of the format, and it is not what these limits should rest on.
"""

import os
import zipfile

# Ceilings chosen against the backend container's 350M limit. Surgery holds
# roughly two copies of the model at its peak (the loaded graph and the buffer
# it is serialised into), so an 80MB model costs ~160MB plus onnx's own
# footprint — the largest that still leaves headroom in the child process.
MAX_EXTRACTED_TOTAL = 150 * 1024 * 1024
MAX_ONNX_FILE = 80 * 1024 * 1024

_CHUNK = 1024 * 1024


class ArchiveRejected(Exception):
    """The archive is unsafe or too large. Always maps to 400."""


def _safe_destination(dest_dir: str, member_name: str) -> str:
    """Resolve a member to a path inside dest_dir, or refuse.

    `ZipFile.extractall` sanitises member paths on the way out; writing members
    by hand does not, so the traversal check has to happen here or bounded
    extraction would reintroduce a zip-slip that extractall never had.
    """
    root = os.path.realpath(dest_dir)
    target = os.path.realpath(os.path.join(root, member_name))
    if target != root and not target.startswith(root + os.sep):
        raise ArchiveRejected("The ZIP archive contains an unsafe file path.")
    return target


def _too_large(limit_bytes: int, what: str) -> ArchiveRejected:
    return ArchiveRejected(
        f"{what} exceeds the {limit_bytes // (1024 * 1024)}MB limit after "
        f"decompression. Compressed size is not the constraint here — the "
        f"server has to hold the model in memory to modify it."
    )


def extract_bounded(zip_path: str, dest_dir: str) -> None:
    """Extract every member of zip_path into dest_dir, under fixed size limits.

    Raises:
        ArchiveRejected: on a traversal attempt or either size limit.
        zipfile.BadZipFile: if the archive cannot be read.
    """
    with zipfile.ZipFile(zip_path, "r") as archive:
        members = [info for info in archive.infolist() if not info.is_dir()]

        # First pass: believe the headers, and reject cheaply if they already
        # admit the archive is too big.
        declared_total = sum(info.file_size for info in members)
        if declared_total > MAX_EXTRACTED_TOTAL:
            raise _too_large(MAX_EXTRACTED_TOTAL, "The archive")

        for info in members:
            if info.filename.lower().endswith(".onnx") and info.file_size > MAX_ONNX_FILE:
                raise _too_large(MAX_ONNX_FILE, "The ONNX model")

        # Second pass: count what actually lands on disk, and stop mid-write if
        # the total ever passes the limit regardless of what the headers said.
        written_total = 0
        for info in members:
            target = _safe_destination(dest_dir, info.filename)
            os.makedirs(os.path.dirname(target), exist_ok=True)

            is_onnx = target.lower().endswith(".onnx")
            written_member = 0

            with archive.open(info) as source, open(target, "wb") as sink:
                while True:
                    chunk = source.read(_CHUNK)
                    if not chunk:
                        break

                    written_total += len(chunk)
                    written_member += len(chunk)

                    if written_total > MAX_EXTRACTED_TOTAL:
                        raise _too_large(MAX_EXTRACTED_TOTAL, "The archive")
                    if is_onnx and written_member > MAX_ONNX_FILE:
                        raise _too_large(MAX_ONNX_FILE, "The ONNX model")

                    sink.write(chunk)
