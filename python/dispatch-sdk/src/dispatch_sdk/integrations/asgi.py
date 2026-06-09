"""Framework-agnostic ASGI middleware (Starlette, FastAPI, Quart, ...). Wraps the app, captures
exceptions raised while handling an HTTP request (handled:false) with request context, and
re-raises so the framework's own error handling is unchanged.

    from dispatch_sdk.integrations.asgi import DispatchASGIMiddleware
    app.add_middleware(DispatchASGIMiddleware)
"""

from __future__ import annotations

from typing import Any, Awaitable, Callable, Mapping, Optional

from ..client import Client
from .request import request_from_asgi, resolve_client

Scope = Mapping[str, Any]
Receive = Callable[[], Awaitable[Any]]
Send = Callable[[Any], Awaitable[None]]
ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]


class DispatchASGIMiddleware:
    def __init__(self, app: ASGIApp, client: Optional[Client] = None) -> None:
        self.app = app
        self._client = client

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return
        try:
            await self.app(scope, receive, send)
        except Exception as exc:
            self._capture(exc, scope)
            raise

    def _capture(self, exc: BaseException, scope: Scope) -> None:
        client = resolve_client(self._client)
        if client is None:
            return
        client.capture_exception(
            exc,
            handled=False,
            request=request_from_asgi(scope),
        )
