"""Configuration: options -> a resolved, frozen Config, with the gem's derivations
(error_endpoint, report_base_url, environment gating)."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional
from urllib.parse import urlsplit

from .version import SDK_NAME, SDK_VERSION

DEFAULT_ENDPOINT = "https://dispatchit.app/api/v1/tickets"
DEFAULT_ENABLED_ENVIRONMENTS = ["production", "staging"]

BeforeSend = Callable[[Dict[str, Any]], Optional[Dict[str, Any]]]


@dataclass(frozen=True)
class Config:
    api_key: str
    endpoint: str
    error_endpoint: str
    report_base_url: Optional[str]
    environment: str
    release: Optional[str]
    enabled_environments: List[str]
    capture_exceptions: bool
    error_sample_rate: float
    before_send: Optional[BeforeSend]
    user: Optional[Dict[str, Any]]
    tags: Dict[str, Any]
    sdk_name: str
    sdk_version: str
    debug: bool
    project_root: str


def derive_error_endpoint(endpoint: str) -> str:
    """Same host, last path segment swapped to /store ("/api/v1/tickets" -> "/api/v1/store")."""
    return re.sub(r"/[^/]+$", "/store", endpoint)


def derive_report_base_url(endpoint: str) -> Optional[str]:
    """Origin (scheme://host[:port]) of the endpoint, or None if unparseable."""
    parts = urlsplit(endpoint)
    if not parts.scheme or not parts.netloc:
        return None
    return f"{parts.scheme}://{parts.netloc}"


def resolve_config(
    api_key: str,
    *,
    endpoint: str = DEFAULT_ENDPOINT,
    error_endpoint: Optional[str] = None,
    report_base_url: Optional[str] = None,
    environment: Optional[str] = None,
    release: Optional[str] = None,
    enabled_environments: Optional[List[str]] = None,
    capture_exceptions: bool = True,
    error_sample_rate: float = 1.0,
    before_send: Optional[BeforeSend] = None,
    user: Optional[Dict[str, Any]] = None,
    tags: Optional[Dict[str, Any]] = None,
    sdk_name: str = SDK_NAME,
    sdk_version: str = SDK_VERSION,
    debug: bool = False,
    project_root: Optional[str] = None,
) -> Config:
    return Config(
        api_key=api_key,
        endpoint=endpoint,
        error_endpoint=error_endpoint or derive_error_endpoint(endpoint),
        report_base_url=(
            report_base_url if report_base_url is not None else derive_report_base_url(endpoint)
        ),
        environment=environment or os.environ.get("DISPATCH_ENVIRONMENT") or "production",
        release=release,
        enabled_environments=(
            list(enabled_environments)
            if enabled_environments is not None
            else list(DEFAULT_ENABLED_ENVIRONMENTS)
        ),
        capture_exceptions=capture_exceptions,
        error_sample_rate=error_sample_rate,
        before_send=before_send,
        user=user,
        tags=dict(tags) if tags else {},
        sdk_name=sdk_name,
        sdk_version=sdk_version,
        debug=debug,
        project_root=project_root or os.getcwd(),
    )


def configured(c: Config) -> bool:
    return bool(c.api_key) and bool(c.endpoint)


def environment_enabled(c: Config) -> bool:
    return len(c.enabled_environments) == 0 or c.environment in c.enabled_environments


def error_tracking_enabled(c: Config) -> bool:
    return configured(c) and c.capture_exceptions
