"""ASGI middleware applied before the application sees a request."""

from typing import Any, Awaitable, Callable

from starlette.responses import JSONResponse

Scope = dict[str, Any]
Receive = Callable[[], Awaitable[dict[str, Any]]]
Send = Callable[[dict[str, Any]], Awaitable[None]]


def _content_length(scope: Scope) -> int | None:
    """The declared body size, or None when absent or unparseable."""
    for name, value in scope.get("headers") or []:
        if name == b"content-length":
            try:
                return int(value)
            except ValueError:
                return None
    return None


class ContentLengthLimitMiddleware:
    """Refuses an oversized request before anything spools it to disk.

    The handler's own 50MB check runs after FastAPI has resolved `UploadFile`,
    which means python-multipart has already consumed the body and written it to
    a temp file. That check bounds what gets *processed*; it does not bound what
    gets *received*. This runs in the ASGI layer, reads `Content-Length`, and
    answers 413 without touching the body.

    A request that declares no length — chunked transfer encoding — is passed
    through. There is nothing to check yet, the handler's cap still applies, and
    nginx bounds the body upstream with `client_max_body_size`.
    """

    def __init__(self, app: Any, *, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        length = _content_length(scope)
        if length is not None and length > self.max_bytes:
            limit_mb = self.max_bytes / (1024 * 1024)
            response = JSONResponse(
                {"detail": f"Request body exceeds the {limit_mb:.0f}MB limit."},
                status_code=413,
            )
            await response(scope, receive, send)
            return

        await self.app(scope, receive, send)
