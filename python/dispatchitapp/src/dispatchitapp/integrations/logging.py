"""A logging.Handler that turns error log records carrying an exception into Dispatch events —
the closest Python analogue to the gem's Rails.error subscriber (errors surfaced through a
central channel). Attach it to any logger:

    import logging, dispatchitapp
    from dispatchitapp.integrations.logging import DispatchHandler

    dispatchitapp.init(api_key=..., environment="production")
    logging.getLogger().addHandler(DispatchHandler(level=logging.ERROR))

Only records with exc_info (e.g. logger.exception(...) or logger.error(..., exc_info=True))
produce an event; plain messages are ignored.
"""

from __future__ import annotations

import logging
from typing import Optional

from ..client import Client

# logging levelno -> contract event level, matching Sentry's convention.
_LEVELS = (
    (logging.CRITICAL, "fatal"),
    (logging.ERROR, "error"),
    (logging.WARNING, "warning"),
    (logging.INFO, "info"),
    (logging.DEBUG, "debug"),
)


def map_level(levelno: int) -> str:
    for threshold, name in _LEVELS:
        if levelno >= threshold:
            return name
    return "debug"


def _resolve_client() -> Optional[Client]:
    from dispatchitapp import get_client

    return get_client()


class DispatchHandler(logging.Handler):
    def __init__(self, client: Optional[Client] = None, level: int = logging.ERROR) -> None:
        super().__init__(level)
        self._client = client

    def emit(self, record: logging.LogRecord) -> None:
        try:
            client = self._client or _resolve_client()
            if client is None or not record.exc_info:
                return
            exc = record.exc_info[1]
            if exc is None:
                return
            client.capture_exception(
                exc,
                handled=False,
                level=map_level(record.levelno),
                tags={"logger": record.name},
            )
        except Exception:
            # A logging handler must never raise.
            pass
