"""The capture pipeline and public client. Mirrors the gem's Reporter + Dispatch::Rails API:
gate on config/environment, dedup, sample, build, before_send, deliver — and NEVER raise."""

from __future__ import annotations

import random
import sys
from typing import Any, Callable, Dict, List, Optional

from .config import (
    Config,
    configured,
    environment_enabled,
    error_tracking_enabled,
    resolve_config,
)
from .dedup import already_captured, mark_captured
from .event import build_event
from .sampling import sampled_out
from .ticket import build_ticket_payload
from .transport import Transport


def _current_exception() -> Optional[BaseException]:
    return sys.exc_info()[1]


class Client:
    def __init__(
        self,
        *,
        transport: Optional[Transport] = None,
        platform: str = "python",
        rng: Optional[Callable[[], float]] = None,
        **options: Any,
    ) -> None:
        self.config: Config = resolve_config(**options)
        self.transport: Transport = transport or Transport(self.config)
        self._platform = platform
        self._rng: Callable[[], float] = rng or random.random

    def capture_exception(
        self,
        exc: Optional[BaseException] = None,
        *,
        handled: bool = True,
        level: str = "error",
        user: Optional[Dict[str, Any]] = None,
        tags: Optional[Dict[str, Any]] = None,
        request: Optional[Dict[str, Any]] = None,
        transaction: Optional[str] = None,
        server_name: Optional[str] = None,
    ) -> None:
        try:
            error = exc if exc is not None else _current_exception()
            if error is None:
                return
            c = self.config
            if not error_tracking_enabled(c):
                return
            if not environment_enabled(c):
                return
            if already_captured(error):
                return
            if sampled_out(c.error_sample_rate, self._rng):
                return
            mark_captured(error)

            event = build_event(
                error,
                config=c,
                handled=handled,
                platform=self._platform,
                level=level,
                user=user,
                tags=tags,
                request=request,
                transaction=transaction,
                server_name=server_name,
            )
            if c.before_send is not None:
                result = c.before_send(event)
                if result is None:
                    return
                event = result

            self.transport.send_event(event)
        except Exception as err:  # telemetry must never break the app
            if self.config.debug:
                print(f"[dispatch] capture failed: {err}")

    def report(
        self,
        *,
        description: str,
        title: Optional[str] = None,
        severity: Optional[str] = None,
        source: str = "api",
        metadata: Optional[Dict[str, Any]] = None,
        reporter: Optional[Dict[str, Any]] = None,
        correlation_id: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
    ) -> Optional[Dict[str, Any]]:
        if not configured(self.config):
            return None
        try:
            payload = build_ticket_payload(
                description=description,
                title=title,
                severity=severity,
                source=source,
                metadata=metadata,
                reporter=reporter,
                correlation_id=correlation_id,
                attachments=attachments,
            )
            return self.transport.post_ticket(payload)
        except Exception:
            return None

    def flush(self, timeout: float = 2.0) -> bool:
        return self.transport.flush(timeout)
