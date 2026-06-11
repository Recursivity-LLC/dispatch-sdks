"""Build the { "ticket": {...} } body for the tickets endpoint. Mirrors Dispatch::Rails.report."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from .types import TicketPayload
from .util import compact


def build_ticket_payload(
    *,
    description: str,
    title: Optional[str] = None,
    severity: Optional[str] = None,
    source: str = "api",
    metadata: Optional[Dict[str, Any]] = None,
    reporter: Optional[Dict[str, Any]] = None,
    correlation_id: Optional[str] = None,
    attachments: Optional[List[Dict[str, Any]]] = None,
) -> TicketPayload:
    meta: Dict[str, Any] = dict(metadata or {})
    if correlation_id:
        meta["correlation_id"] = correlation_id

    ticket = compact(
        {
            "description": description,
            "title": title,
            "source": source,
            "severity": severity,
            "metadata": meta if meta else None,
            "reporter": reporter,
            "attachments": attachments,
        }
    )
    return {"ticket": ticket}
