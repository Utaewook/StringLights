"""Runs graph surgery in a throwaway child process.

One mechanism solves two problems.

Surgery is synchronous, CPU-bound protobuf work. Called directly from an `async`
endpoint it holds the event loop for its entire duration, and with one uvicorn
worker the server answers nothing at all while it runs — not another surgery
request, and not `/api/health`. Any health probe pointed at this service would
report an outage every time someone uploaded a model.

Surgery is also the only place where memory use scales with user input, which
makes it the only place that can OOM-kill the container. A thread would fix the
first problem and not the second: Python threads cannot be interrupted, so a
timed-out surgery would keep both its CPU and its memory, and the timeout would
be decoration.

A child process fixes both. The event loop only ever waits on a pipe, a timeout
can actually stop the work, and when the child exits the OS reclaims everything
`onnx` allocated — which no amount of `del` inside a single long-lived process
can guarantee.

`onnx` is imported inside the worker rather than at module scope on purpose. The
parent should not carry the library's resident footprint for the lifetime of the
container when only the child ever needs it.
"""

import asyncio
import multiprocessing
import sys
from typing import Any

# spawn, not fork: uvicorn is multi-threaded, and forking a process that holds
# locks in other threads can deadlock the child. Python 3.12 deprecates fork
# from a threaded parent for this reason. The cost is that the child re-imports
# onnx, which is the trade this module already wants to make.
_MP = multiprocessing.get_context("spawn")


class SurgeryRejected(Exception):
    """The model is not something this service will process. Maps to 400."""


class SurgeryTimeout(Exception):
    """Surgery outlived its budget and was killed. Maps to 504."""


class SurgeryFailed(Exception):
    """Surgery died or raised something unexpected. Maps to 500."""


def _worker(conn: Any, model_path: str, output_path: str, data_dir: str) -> None:
    """Child entry point. Sends exactly one (status, payload) tuple, then exits."""
    try:
        from app.services.surgery import run_graph_surgery

        conn.send(("ok", run_graph_surgery(model_path, output_path, data_dir)))
    except ValueError as exc:
        # Deliberate rejections — opset out of range, missing external data.
        # These are statements about the user's model and are safe to forward.
        conn.send(("rejected", str(exc)))
    except BaseException as exc:  # noqa: BLE001 - the child must never die silently
        # Anything else is ours, not theirs. The detail goes to the container
        # log; the client gets a message that names no internal path or symbol.
        print(f"Surgery failed: {type(exc).__name__}: {exc}", file=sys.stderr, flush=True)
        conn.send(("failed", "Graph surgery failed while processing this model."))
    finally:
        conn.close()


async def run_surgery_isolated(
    model_path: str,
    output_path: str,
    data_dir: str,
    timeout_seconds: float,
) -> dict:
    """Run graph surgery in a child process and return its metadata.

    Raises:
        SurgeryRejected: the model was refused for a reason worth telling the user.
        SurgeryTimeout:  the child outlived timeout_seconds and was killed.
        SurgeryFailed:   the child raised, or died without sending a result.
    """
    receiver, sender = _MP.Pipe(duplex=False)
    child = _MP.Process(
        target=_worker,
        args=(sender, model_path, output_path, data_dir),
        daemon=True,
    )
    child.start()
    # Only the child should hold the write end; otherwise recv() would never see
    # EOF when the child dies, and a crash would read as a hang.
    sender.close()

    try:
        try:
            status, payload = await asyncio.wait_for(
                asyncio.to_thread(receiver.recv), timeout_seconds
            )
        except asyncio.TimeoutError:
            raise SurgeryTimeout(
                f"Graph surgery exceeded the {int(timeout_seconds)}s limit and "
                f"was stopped. The model is likely too large or too complex for "
                f"this server."
            ) from None
        except EOFError:
            # The child died without sending anything. On this host that almost
            # always means the kernel OOM-killed it.
            raise SurgeryFailed(
                "Graph surgery stopped unexpectedly. The model is most likely "
                "too large for the server's memory budget."
            ) from None
    finally:
        # Unconditional: on the timeout path this is what actually stops the
        # work and returns the memory, and on every other path the child has
        # already sent its result and is on its way out.
        if child.is_alive():
            child.kill()
        child.join(timeout=5)
        receiver.close()

    if status == "ok":
        return payload
    if status == "rejected":
        raise SurgeryRejected(payload)
    raise SurgeryFailed(payload)
