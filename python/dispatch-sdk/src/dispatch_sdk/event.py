"""Build the Sentry-shaped event from an exception. Mirrors the gem's EventBuilder."""

from __future__ import annotations

import time
import uuid as _uuid
from typing import Any, Callable, Dict, List, Optional

from .config import Config
from .stacktrace import frames_from_traceback
from .types import DispatchEvent, ExceptionValue
from .util import compact

MAX_CAUSES = 5
VALUE_MAX_LENGTH = 2000


def _exception_type_name(exc: BaseException) -> str:
    t = type(exc)
    module = getattr(t, "__module__", "") or ""
    if module in ("builtins", "__main__", ""):
        return t.__qualname__
    return f"{module}.{t.__qualname__}"


def _cause_of(exc: BaseException) -> Optional[BaseException]:
    """Follow the exception chain the way Python prints it: explicit `raise ... from` wins,
    otherwise the implicit context (unless suppressed). Uses typed attribute access so the
    chain stays BaseException|None rather than Any."""
    if exc.__cause__ is not None:
        return exc.__cause__
    if not exc.__suppress_context__:
        return exc.__context__
    return None


def _exception_value(exc: BaseException, handled: bool, project_root: str) -> ExceptionValue:
    tb = getattr(exc, "__traceback__", None)
    return {
        "type": _exception_type_name(exc),
        "value": str(exc)[:VALUE_MAX_LENGTH],
        "mechanism": {"type": "generic", "handled": handled},
        "stacktrace": {"frames": frames_from_traceback(tb, project_root)},
    }


def _exception_values(
    exc: BaseException, handled: bool, project_root: str
) -> List[ExceptionValue]:
    chain: List[BaseException] = []
    current: Optional[BaseException] = exc
    depth = 0
    while current is not None and depth < MAX_CAUSES:
        chain.append(current)
        current = _cause_of(current)
        depth += 1
    chain.reverse()  # oldest cause first, raised exception last
    return [_exception_value(e, handled, project_root) for e in chain]


def build_event(
    exc: BaseException,
    *,
    config: Config,
    handled: bool,
    platform: str = "python",
    level: str = "error",
    user: Optional[Dict[str, Any]] = None,
    tags: Optional[Dict[str, Any]] = None,
    request: Optional[Dict[str, Any]] = None,
    transaction: Optional[str] = None,
    server_name: Optional[str] = None,
    now: Callable[[], float] = time.time,
    uuid: Callable[[], str] = lambda: _uuid.uuid4().hex,
) -> DispatchEvent:
    derived: Dict[str, Any] = {}
    if transaction:
        derived["transaction"] = transaction
    merged_tags: Dict[str, Any] = {**derived, **config.tags, **(tags or {})}

    event: DispatchEvent = {
        "event_id": uuid(),
        "timestamp": now(),
        "platform": platform,
        "level": level,
        "environment": config.environment,
        "exception": {"values": _exception_values(exc, handled, config.project_root)},
    }
    event.update(
        compact(
            {
                "release": config.release,
                "server_name": server_name,
                "transaction": transaction,
                "request": request,
                "user": user if user is not None else config.user,
                "tags": merged_tags if merged_tags else None,
                "sdk": {"name": config.sdk_name, "version": config.sdk_version},
            }
        )
    )
    return event
