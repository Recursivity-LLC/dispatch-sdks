"""Process-lifecycle capture — the Python analogue of the gem's at_exit hook.

`sys.excepthook` sees the exception that is about to kill the process (a crash in a
script, a runner, a misconfigured worker boot); an `atexit` hook then drains the
transport queue so a shutdown doesn't drop already-captured events. Exceptions captured
upstream (middleware, logging integration) carry the dedup marker and aren't re-sent.

Skipped, mirroring the gem's "normal shutdowns are not crashes" rule: SystemExit never
reaches excepthook, and KeyboardInterrupt is ignored — SIGINT/Ctrl-C is how process
managers (gunicorn, uWSGI) ask for a stop, the moral equivalent of the gem's SIGTERM.
"""

from __future__ import annotations

import atexit
import sys
from types import TracebackType
from typing import Callable, Optional, Type

from .client import Client

ExceptHook = Callable[
    [Type[BaseException], BaseException, Optional[TracebackType]],
    object,
]


def install_lifecycle_hooks(client: Client) -> Callable[[], None]:
    """Install the excepthook capture + atexit flush. Returns an uninstall callable."""
    config = client.config
    previous: ExceptHook = sys.excepthook
    installed_hook: Optional[ExceptHook] = None

    if config.capture_at_exit:

        def dispatch_excepthook(
            exc_type: Type[BaseException],
            exc: BaseException,
            tb: Optional[TracebackType],
        ) -> object:
            if not isinstance(exc, KeyboardInterrupt):
                client.capture_exception(exc, handled=False, tags={"source": "excepthook"})
            # Chain so the native traceback (or another SDK's hook) still prints.
            return previous(exc_type, exc, tb)

        installed_hook = dispatch_excepthook
        sys.excepthook = dispatch_excepthook

    def flush_on_exit() -> None:
        timeout = float(config.shutdown_timeout)
        if timeout > 0:
            client.flush(timeout)

    # Registered after the app's own handlers were (atexit is LIFO), so ours runs first
    # only relative to later registrations; either way excepthook has already enqueued.
    atexit.register(flush_on_exit)

    def uninstall() -> None:
        if installed_hook is not None and sys.excepthook is installed_hook:
            sys.excepthook = previous
        atexit.unregister(flush_on_exit)

    return uninstall
