"""Prevent the same exception object from being reported twice (e.g. by both a framework
handler and a global handler). We tag the exception with a marker attribute, exactly like the
gem's @__dispatch_captured instance variable — builtin exception instances are not always
weak-referenceable (notably on CPython 3.14), so a WeakSet is not reliable here."""

from __future__ import annotations

from typing import Any

_MARKER = "_dispatch_captured"


def already_captured(exc: Any) -> bool:
    return getattr(exc, _MARKER, False) is True


def mark_captured(exc: Any) -> None:
    try:
        setattr(exc, _MARKER, True)
    except (AttributeError, TypeError):
        # Objects with __slots__ and no matching slot can't take the marker; skip dedup
        # for those rather than fail.
        pass
