"""Small shared helpers."""

from __future__ import annotations

from typing import Any, Dict


def compact(d: Dict[str, Any]) -> Dict[str, Any]:
    """Drop keys whose value is None — the analogue of Ruby's Hash#compact, so absent fields
    are omitted from the wire payload rather than sent as null."""
    return {k: v for k, v in d.items() if v is not None}
