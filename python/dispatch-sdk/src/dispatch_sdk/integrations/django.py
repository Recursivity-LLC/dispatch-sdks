"""Django integration. Add it to MIDDLEWARE (last, so it's innermost):

    MIDDLEWARE = [
        ...,
        "dispatch_sdk.integrations.django.DispatchMiddleware",
    ]

process_exception captures the view exception (handled:false) with request + route + user
context, then returns None so Django's own error handling proceeds unchanged."""

from __future__ import annotations

from typing import Any, Dict, Optional

from .request import normalize_user, request_from_wsgi, resolve_client


def _transaction(request: Any) -> Optional[str]:
    match = getattr(request, "resolver_match", None)
    view_name = getattr(match, "view_name", None) if match is not None else None
    if view_name:
        return str(view_name)
    method = getattr(request, "method", None)
    path = getattr(request, "path", None)
    if method and path:
        return f"{method} {path}"
    return None


def _user(request: Any) -> Optional[Dict[str, Any]]:
    user = getattr(request, "user", None)
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    return normalize_user(user)


class DispatchMiddleware:
    def __init__(self, get_response: Any) -> None:
        self.get_response = get_response

    def __call__(self, request: Any) -> Any:
        return self.get_response(request)

    def process_exception(self, request: Any, exception: BaseException) -> None:
        client = resolve_client(None)
        if client is None:
            return None
        client.capture_exception(
            exception,
            handled=False,
            request=request_from_wsgi(request.META),
            transaction=_transaction(request),
            user=_user(request),
        )
        return None
