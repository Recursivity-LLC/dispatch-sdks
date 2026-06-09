"""Flask integration via the got_request_exception signal (fires on an unhandled request
exception, before Flask renders the 500 — it doesn't swallow):

    import dispatch_sdk
    from dispatch_sdk.integrations.flask import install

    app = Flask(__name__)
    dispatch_sdk.init(api_key=..., environment="production")
    install(app)

Requires blinker (a Flask dependency)."""

from __future__ import annotations

from typing import Any, Callable, Optional

from ..client import Client
from .request import normalize_user, request_from_wsgi, resolve_client


def _transaction(req: Any) -> Optional[str]:
    rule = getattr(req, "url_rule", None)
    rule_str = getattr(rule, "rule", None) if rule is not None else None
    if not rule_str:
        return None
    method = getattr(req, "method", None)
    return f"{method} {rule_str}" if method else str(rule_str)


def install(
    app: Any = None,
    client: Optional[Client] = None,
    user: Optional[Callable[[], Any]] = None,
) -> Callable[..., None]:
    """Connect the handler to got_request_exception and return it (for later disconnect)."""
    from flask import got_request_exception
    from flask import request as flask_request

    def handler(sender: Any, exception: Optional[BaseException] = None, **extra: Any) -> None:
        resolved = resolve_client(client)
        if resolved is None or exception is None:
            return
        resolved.capture_exception(
            exception,
            handled=False,
            request=request_from_wsgi(flask_request.environ),
            transaction=_transaction(flask_request),
            user=normalize_user(user()) if user else None,
        )

    # weak=False: `handler` is a local closure; with blinker's default weak refs it would be
    # garbage-collected as soon as install() returns and never fire.
    if app is not None:
        got_request_exception.connect(handler, app, weak=False)
    else:
        got_request_exception.connect(handler, weak=False)
    return handler
