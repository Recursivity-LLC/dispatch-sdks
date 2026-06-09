"""dispatch-sdk — the Python client for Dispatch (error tracking + bug reports).

Minimal usage:

    import dispatch_sdk

    dispatch_sdk.init(
        api_key=os.environ["DISPATCH_API_KEY"],
        environment=os.environ.get("ENV", "production"),
        release=os.environ.get("GIT_SHA"),
    )

    try:
        do_risky_thing()
    except Exception:
        dispatch_sdk.capture_exception()  # reads the current exception

    # File a curated report (the API-only analogue of the widget):
    dispatch_sdk.report(description="Nightly import aborted: upstream 502", severity="high")
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from .client import Client
from .config import Config, resolve_config
from .event import build_event
from .ticket import build_ticket_payload
from .version import CONTRACT_VERSION, SDK_NAME, SDK_VERSION

__all__ = [
    "init",
    "get_client",
    "capture_exception",
    "report",
    "flush",
    "Client",
    "Config",
    "resolve_config",
    "build_event",
    "build_ticket_payload",
    "SDK_NAME",
    "SDK_VERSION",
    "CONTRACT_VERSION",
]

_default_client: Optional[Client] = None


def init(**options: Any) -> Client:
    """Initialise the default client. Call once at startup. Returns it for direct use."""
    global _default_client
    _default_client = Client(**options)
    return _default_client


def get_client() -> Optional[Client]:
    return _default_client


def capture_exception(exc: Optional[BaseException] = None, **kwargs: Any) -> None:
    if _default_client is not None:
        _default_client.capture_exception(exc, **kwargs)


def report(**kwargs: Any) -> Optional[Dict[str, Any]]:
    if _default_client is not None:
        return _default_client.report(**kwargs)
    return None


def flush(timeout: float = 2.0) -> bool:
    if _default_client is not None:
        return _default_client.flush(timeout)
    return True
