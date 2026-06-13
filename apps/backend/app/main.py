import os
import json
import shutil
import uuid
import zipfile
import asyncio
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status, BackgroundTasks
from fastapi.responses import FileResponse
from app.services.surgery import run_graph_surgery

app = FastAPI(title="StringLights Backend", version="2.0.0")

# Semaphore to serialize graph surgery and protect 512MB RAM server
surgery_semaphore = asyncio.Semaphore(1)

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
TEMP_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "temp")


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
    # 1. Early validation of file size
    file.file.seek(0, os.SEEK_END)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Uploaded ZIP file size exceeds the 50MB limit (Uploaded: {file_size / (1024*1024):.2f}MB)",
        )

    # Verify file extension is ZIP
    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only ZIP archive file uploads are supported.",
        )

    # 2. Setup temporary workspace
    session_id = str(uuid.uuid4())
    temp_dir   = os.path.join(TEMP_ROOT, session_id)
    os.makedirs(temp_dir, exist_ok=True)

    zip_path    = os.path.join(temp_dir, "input.zip")
    extract_dir = os.path.join(temp_dir, "extracted")
    os.makedirs(extract_dir, exist_ok=True)

    # Acquire Semaphore to serialize graph manipulation
    async with surgery_semaphore:
        try:
            # Write zip upload stream to temp path
            with open(zip_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            # Extract ZIP file
            try:
                with zipfile.ZipFile(zip_path, "r") as zip_ref:
                    zip_ref.extractall(extract_dir)
            except zipfile.BadZipFile:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid ZIP archive file.",
                )

            # Find the single ONNX file
            onnx_files = [f for f in os.listdir(extract_dir) if f.lower().endswith(".onnx")]
            if len(onnx_files) == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No ONNX model (.onnx) found in the ZIP archive.",
                )
            elif len(onnx_files) > 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Multiple ONNX models found. The ZIP archive must contain exactly one .onnx file.",
                )

            onnx_filename  = onnx_files[0]
            input_onnx_path  = os.path.join(extract_dir, onnx_filename)
            output_onnx_path = os.path.join(temp_dir, f"modified_{onnx_filename}")

            # 3. Perform Graph Surgery (or copy) and get metadata
            if perform_surgery:
                try:
                    graph_meta = run_graph_surgery(
                        input_onnx_path,
                        output_onnx_path,
                        data_dir=extract_dir,
                    )
                except ValueError as e:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=str(e),
                    )
                except Exception as e:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Graph surgery failed: {str(e)}",
                    )
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

            # Return ZIP file stream
            return FileResponse(
                output_zip_path,
                media_type="application/zip",
                filename=f"modified_{onnx_filename}.zip",
            )

        except Exception as e:
            cleanup_directory(temp_dir)
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An unexpected error occurred: {str(e)}",
            )


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}
