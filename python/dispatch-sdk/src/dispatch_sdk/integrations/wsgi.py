"""Framework-agnostic WSGI middleware. Wrap your WSGI app as the innermost middleware so it
sees the raw exception with request context, captures it (handled:false), and re-raises — it
never swallows. Mirrors the gem's Rack middleware.

    from dispatch_sdk.integrations.wsgi import DispatchWSGIMiddleware
    application = DispatchWSGIMiddleware(application)
"""

from __future__ import annotations

from typing import Any, Callable, Dict, Iterable, Optional

from ..client import Client
from .request import request_from_wsgi, resolve_client

Environ = Dict[str, Any]
StartResponse = Callable[..., Any]
WSGIApp = Callable[[Environ, StartResponse], Iterable[bytes]]


class DispatchWSGIMiddleware:
    def __init__(self, app: WSGIApp, client: Optional[Client] = None) -> None:
        self.app = app
        self._client = client

    def __call__(self, environ: Environ, start_response: StartResponse) -> Iterable[bytes]:
        try:
            return self.app(environ, start_response)
        except Exception as exc:
            self._capture(exc, environ)
            raise

    def _capture(self, exc: BaseException, environ: Environ) -> None:
        client = resolve_client(self._client)
        if client is None:
            return
        client.capture_exception(
            exc,
            handled=False,
            request=request_from_wsgi(environ),
        )
