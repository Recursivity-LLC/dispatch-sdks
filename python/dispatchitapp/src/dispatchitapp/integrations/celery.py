"""Celery integration — capture background task failures via the task_failure signal, the
direct analogue of the gem's Rails.error subscriber catching ActiveJob errors.

    import dispatchitapp
    from dispatchitapp.integrations.celery import install

    dispatchitapp.init(api_key=..., environment="production")
    install()  # connects to celery's task_failure signal

Requires the [celery] extra: pip install "dispatchitapp[celery]".
"""

from __future__ import annotations

from typing import Any, Callable, Optional

from ..client import Client


def _resolve_client() -> Optional[Client]:
    from dispatchitapp import get_client

    return get_client()


def install(client: Optional[Client] = None) -> Callable[..., None]:
    """Connect the task_failure handler and return it (so it can be disconnected if needed)."""
    try:
        from celery.signals import task_failure
    except ImportError as err:  # pragma: no cover - exercised only without the extra
        raise ImportError(
            "dispatchitapp.integrations.celery requires Celery. "
            "Install it with: pip install 'dispatchitapp[celery]'"
        ) from err

    def handler(
        sender: Any = None,
        task_id: Optional[str] = None,
        exception: Optional[BaseException] = None,
        einfo: Any = None,
        **kwargs: Any,
    ) -> None:
        resolved = client or _resolve_client()
        if resolved is None or exception is None:
            return
        resolved.capture_exception(
            exception,
            handled=False,
            transaction=getattr(sender, "name", None),
            tags={"task_id": task_id} if task_id else None,
        )

    task_failure.connect(handler, weak=False)
    return handler
