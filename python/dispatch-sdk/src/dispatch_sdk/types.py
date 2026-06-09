"""Wire types mirroring contract/schema/event.schema.json. The event/ticket envelopes are
assembled (and compacted) dynamically, so they're typed as plain dicts; the nested shapes
that are always fully formed get TypedDicts."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, TypedDict


class Frame(TypedDict, total=False):
    abs_path: Optional[str]
    filename: Optional[str]
    function: Optional[str]
    lineno: int
    colno: Optional[int]
    in_app: bool
    pre_context: List[str]
    context_line: str
    post_context: List[str]


class Mechanism(TypedDict):
    type: str
    handled: bool


class Stacktrace(TypedDict):
    frames: List[Frame]


class ExceptionValue(TypedDict):
    type: str
    value: str
    mechanism: Mechanism
    stacktrace: Stacktrace


# Assembled dynamically with optional fields compacted out; kept loose on purpose.
DispatchEvent = Dict[str, Any]
TicketPayload = Dict[str, Any]
TicketResponse = Dict[str, Any]
