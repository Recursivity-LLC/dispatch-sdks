"""Shared request-context extraction for the framework integrations. Builds the contract
`request` object from a WSGI environ or an ASGI scope, plus user normalization and default
client resolution. Mirrors the gem's EventBuilder#request_hash (allow-listed headers only)."""

from __future__ import annotations

from typing import Any, Dict, Mapping, Optional

from ..client import Client
from ..util import compact

# canonical wire name -> WSGI environ key. Content-Type is special-cased (no HTTP_ prefix).
_WSGI_HEADER_KEYS = {
    "User-Agent": "HTTP_USER_AGENT",
    "Referer": "HTTP_REFERER",
    "Accept": "HTTP_ACCEPT",
    "Content-Type": "CONTENT_TYPE",
    "Host": "HTTP_HOST",
    "X-Request-Id": "HTTP_X_REQUEST_ID",
}

# lowercased header name -> canonical wire name (for ASGI, where headers arrive lowercased).
_ASGI_HEADER_KEYS = {
    "user-agent": "User-Agent",
    "referer": "Referer",
    "accept": "Accept",
    "content-type": "Content-Type",
    "host": "Host",
    "x-request-id": "X-Request-Id",
}


def resolve_client(client: Optional[Client]) -> Optional[Client]:
    if client is not None:
        return client
    from dispatch_sdk import get_client

    return get_client()


def normalize_user(user: Any) -> Optional[Dict[str, Any]]:
    """Coerce a user (dict, or an object with id/pk/external_id/email) into { id, email }."""
    if user is None:
        return None
    if isinstance(user, dict):
        uid = user.get("id") or user.get("external_id")
        email = user.get("email")
    else:
        uid = getattr(user, "id", None) or getattr(user, "pk", None) or getattr(
            user, "external_id", None
        )
        email = getattr(user, "email", None)
    out: Dict[str, Any] = {}
    if uid is not None:
        out["id"] = str(uid)
    if email:
        out["email"] = email
    return out or None


def request_from_wsgi(environ: Mapping[str, Any]) -> Dict[str, Any]:
    scheme = environ.get("wsgi.url_scheme", "http")
    host = environ.get("HTTP_HOST") or environ.get("SERVER_NAME")
    path = environ.get("PATH_INFO", "")
    url = f"{scheme}://{host}{path}" if host else (path or None)

    headers: Dict[str, str] = {}
    for canonical, key in _WSGI_HEADER_KEYS.items():
        value = environ.get(key)
        if value:
            headers[canonical] = value

    remote = environ.get("REMOTE_ADDR")
    return compact(
        {
            "url": url,
            "method": environ.get("REQUEST_METHOD"),
            "query_string": environ.get("QUERY_STRING") or None,
            "headers": headers or None,
            "env": {"REMOTE_ADDR": remote} if remote else None,
        }
    )


def request_from_asgi(scope: Mapping[str, Any]) -> Dict[str, Any]:
    raw_headers = scope.get("headers") or []
    lowered: Dict[str, str] = {}
    for key, value in raw_headers:
        lowered[key.decode("latin1").lower()] = value.decode("latin1")

    scheme = scope.get("scheme", "http")
    host = lowered.get("host")
    if not host:
        server = scope.get("server")
        if server:
            host = server[0]
    path = scope.get("path", "")
    url = f"{scheme}://{host}{path}" if host else (path or None)

    headers = {
        canonical: lowered[lower] for lower, canonical in _ASGI_HEADER_KEYS.items() if lower in lowered
    }

    query_bytes = scope.get("query_string") or b""
    query = query_bytes.decode("latin1") if query_bytes else None
    client = scope.get("client")
    remote = client[0] if client else None

    return compact(
        {
            "url": url,
            "method": scope.get("method"),
            "query_string": query,
            "headers": headers or None,
            "env": {"REMOTE_ADDR": remote} if remote else None,
        }
    )
