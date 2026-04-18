import time
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from fastapi.responses import StreamingResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from logging_config import get_logger

logger = get_logger("http")


class LoggingMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        start = time.perf_counter()

        # --- Read request body (must be re-injected for FastAPI to use) ---
        raw_body = await request.body()
        body_text = self._decode_body(raw_body)

        logger.debug(
            "► REQUEST  %s %s",
            request.method,
            request.url.path,
            extra={
                "event": "request",
                "method": request.method,
                "path": request.url.path,
                "query": str(request.url.query) or None,
                "client": request.client.host if request.client else None,
                "headers": dict(request.headers),
                "body": body_text,
            },
        )

        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)

        # --- Streaming responses (SSE): log metadata only ---
        if response.headers.get("content-type", "").startswith("text/event-stream"):
            logger.info(
                "◄ RESPONSE %s %s %d STREAMING | %.0fms",
                request.method,
                request.url.path,
                response.status_code,
                duration_ms,
                extra={
                    "event": "response",
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": duration_ms,
                    "body": "[streaming — SSE]",
                },
            )
            return response

        # --- Normal responses: capture body ---
        response_body = b""
        async for chunk in response.body_iterator:
            response_body += chunk

        body_out = self._decode_body(response_body)

        level = "error" if response.status_code >= 500 else "warning" if response.status_code >= 400 else "info"
        getattr(logger, level)(
            "◄ RESPONSE %s %s %d | %.0fms",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            extra={
                "event": "response",
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "headers": dict(response.headers),
                "body": body_out,
            },
        )

        return Response(
            content=response_body,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )

    @staticmethod
    def _decode_body(raw: bytes) -> str | dict | list | None:
        if not raw:
            return None
        try:
            import json
            return json.loads(raw)
        except Exception:
            try:
                return raw.decode("utf-8")
            except Exception:
                return f"<binary {len(raw)} bytes>"
