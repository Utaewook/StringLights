import os
import json
import logging
import shutil
import uuid
import zipfile
import asyncio
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status, BackgroundTasks
from fastapi.responses import FileResponse
from app.metrics import QueueCounter, SurgeryLog
from app.middleware import ContentLengthLimitMiddleware
from app.services.archive import ArchiveRejected, extract_bounded
from app.services.isolation import (
    SurgeryFailed,
    SurgeryRejected,
    SurgeryTimeout,
    run_surgery_isolated,
)

logger = logging.getLogger(__name__)

app = FastAPI(title="StringLights Backend", version="2.2.0")

# Serialises graph surgery. The bound that matters is the *container's* 350M
# (build/docker-compose.yml), not the host's 512MB — the host also carries the
# frontend container and the OS. See docs/issues/012.
surgery_semaphore = asyncio.Semaphore(1)
queue_counter = QueueCounter()

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB, measured on the uploaded archive

# The whole multipart request, which wraps the file in an envelope, so it sits
# above MAX_FILE_SIZE. Matches nginx's client_max_body_size: the two bound the
# same thing and drifting apart would mean one of them never fires.
MAX_REQUEST_BYTES = 55 * 1024 * 1024

app.add_middleware(ContentLengthLimitMiddleware, max_bytes=MAX_REQUEST_BYTES)

# Kept below nginx's proxy_read_timeout of 120s so a slow model surfaces as this
# service's 504 with a usable message, rather than nginx's generic gateway error.
SURGERY_TIMEOUT_SECONDS = 90
TEMP_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "temp")


def _http_error(rec: SurgeryLog, outcome: str, code: int, detail: str) -> HTTPException:
    """Logs the outcome of a refused request and returns the error to raise."""
    rec.emit(outcome, code)
    return HTTPException(status_code=code, detail=detail)


def cleanup_directory(path: str) -> None:
    """Safely removes a temporary directory."""
    if os.path.exists(path):
        shutil.rmtree(path)


@app.post("/api/surgery")
async def perform_surgery(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    perform_surgery: bool = Form(True),
):
    rec = SurgeryLog(queue_depth=queue_counter.depth_on_arrival(surgery_semaphore))

    # 1. Early validation of file size
    file.file.seek(0, os.SEEK_END)
    file_size = file.file.tell()
    file.file.seek(0)
    rec.upload_bytes = file_size

    if file_size > MAX_FILE_SIZE:
        raise _http_error(
            rec, "too_large", status.HTTP_400_BAD_REQUEST,
            f"Uploaded ZIP file size exceeds the 50MB limit (Uploaded: {file_size / (1024*1024):.2f}MB)",
        )

    # Verify file extension is ZIP
    if not file.filename.lower().endswith(".zip"):
        raise _http_error(
            rec, "rejected", status.HTTP_400_BAD_REQUEST,
            "Only ZIP archive file uploads are supported.",
        )

    # 2. Setup temporary workspace
    session_id = str(uuid.uuid4())
    temp_dir   = os.path.join(TEMP_ROOT, session_id)
    os.makedirs(temp_dir, exist_ok=True)

    zip_path    = os.path.join(temp_dir, "input.zip")
    extract_dir = os.path.join(temp_dir, "extracted")
    os.makedirs(extract_dir, exist_ok=True)

    # Acquire Semaphore to serialize graph manipulation. The counter sees the
    # wait; it falls again on acquire, on cancel, and on any exception.
    rec.wait_started()
    try:
        await queue_counter.acquire(surgery_semaphore)
    except asyncio.CancelledError:
        cleanup_directory(temp_dir)
        rec.emit("abandoned", 499)
        raise
    rec.wait_ended()
    try:
        try:
            # Write zip upload stream to temp path
            with open(zip_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            # Extract the ZIP under fixed decompressed-size limits. The 50MB
            # cap above bounds the upload, not what it expands into.
            try:
                extract_bounded(zip_path, extract_dir)
            except zipfile.BadZipFile:
                raise _http_error(
                    rec, "bad_zip", status.HTTP_400_BAD_REQUEST,
                    "Invalid ZIP archive file.",
                )
            except ArchiveRejected as e:
                raise _http_error(
                    rec, "rejected", status.HTTP_400_BAD_REQUEST, str(e),
                )

            # Find the single ONNX file
            onnx_files = [f for f in os.listdir(extract_dir) if f.lower().endswith(".onnx")]
            if len(onnx_files) == 0:
                raise _http_error(
                    rec, "rejected", status.HTTP_400_BAD_REQUEST,
                    "No ONNX model (.onnx) found in the ZIP archive.",
                )
            elif len(onnx_files) > 1:
                raise _http_error(
                    rec, "rejected", status.HTTP_400_BAD_REQUEST,
                    "Multiple ONNX models found. The ZIP archive must contain exactly one .onnx file.",
                )

            onnx_filename  = onnx_files[0]
            input_onnx_path  = os.path.join(extract_dir, onnx_filename)
            output_onnx_path = os.path.join(temp_dir, f"modified_{onnx_filename}")

            # 3. Perform Graph Surgery (or copy) and get metadata
            if perform_surgery:
                rec.surgery_started()
                try:
                    graph_meta = await run_surgery_isolated(
                        input_onnx_path,
                        output_onnx_path,
                        extract_dir,
                        timeout_seconds=SURGERY_TIMEOUT_SECONDS,
                    )
                except SurgeryRejected as e:
                    rec.surgery_ended()
                    raise _http_error(
                        rec, "rejected", status.HTTP_400_BAD_REQUEST, str(e),
                    )
                except SurgeryTimeout as e:
                    rec.surgery_ended()
                    raise _http_error(
                        rec, "timeout", status.HTTP_504_GATEWAY_TIMEOUT, str(e),
                    )
                except SurgeryFailed as e:
                    rec.surgery_ended()
                    raise _http_error(
                        rec, "failed", status.HTTP_500_INTERNAL_SERVER_ERROR, str(e),
                    )
                rec.surgery_ended()
                rec.node_count = len(graph_meta.get("nodes", []))
            else:
                shutil.copy2(input_onnx_path, output_onnx_path)
                graph_meta = {}

            # 4. Build output ZIP: modified ONNX + meta.json
            output_zip_path = os.path.join(temp_dir, "output.zip")
            with zipfile.ZipFile(output_zip_path, "w", zipfile.ZIP_DEFLATED) as zip_out:
                zip_out.write(output_onnx_path, arcname=onnx_filename)
                if graph_meta:
                    zip_out.writestr("meta.json", json.dumps(graph_meta, ensure_ascii=False))

            # Register background task to clean up after sending response
            background_tasks.add_task(cleanup_directory, temp_dir)

            rec.emit("ok", status.HTTP_200_OK)

            # Return ZIP file stream
            return FileResponse(
                output_zip_path,
                media_type="application/zip",
                filename=f"modified_{onnx_filename}.zip",
            )

        except asyncio.CancelledError:
            cleanup_directory(temp_dir)
            rec.emit("abandoned", 499)
            raise
        except Exception as e:
            cleanup_directory(temp_dir)
            if isinstance(e, HTTPException):
                raise e
            rec.emit("failed", status.HTTP_500_INTERNAL_SERVER_ERROR)
            # The client gets a stable message; the traceback goes to the
            # container log. Exceptions from onnx.load and protobuf embed the
            # path they were handed, which here is /app/temp/<uuid>/... — that
            # tells the user nothing and describes the container's layout to
            # anyone probing. See docs/issues/013.
            logger.exception("Unhandled error while processing session %s", session_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="The server could not process this model. Please try again.",
            )
    finally:
        surgery_semaphore.release()


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}
