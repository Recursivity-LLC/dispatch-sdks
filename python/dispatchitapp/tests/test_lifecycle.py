"""Lifecycle hooks: sys.excepthook capture + atexit flush (the gem's at_exit analogue)."""

import sys
from typing import Any, Dict, List

import dispatchitapp
from dispatchitapp.client import Client
from dispatchitapp.config import resolve_config
from dispatchitapp.lifecycle import install_lifecycle_hooks
from dispatchitapp.transport import Transport


class FakeTransport(Transport):
    def __init__(self, config):
        super().__init__(config, post_func=lambda *_: (200, "{}"))
        self.events: List[Dict[str, Any]] = []
        self.flush_calls: List[float] = []

    def send_event(self, event):
        self.events.append(event)

    def flush(self, timeout: float = 2.0) -> bool:
        self.flush_calls.append(timeout)
        return True


def make_client(**opts) -> Client:
    opts.setdefault("api_key", "x")
    opts.setdefault("environment", "production")
    client = Client(**opts)
    client.transport = FakeTransport(client.config)
    return client


def _raise_via_hook(exc: BaseException) -> None:
    sys.excepthook(type(exc), exc, None)


def test_config_lifecycle_defaults():
    c = resolve_config("x")
    assert c.capture_at_exit is True
    assert c.shutdown_timeout == 3.0


def test_excepthook_captures_unhandled_and_chains_to_previous():
    seen: List[BaseException] = []
    original = sys.excepthook
    sys.excepthook = lambda t, e, tb: seen.append(e)
    try:
        client = make_client()
        uninstall = install_lifecycle_hooks(client)
        try:
            err = RuntimeError("boot crash")
            _raise_via_hook(err)

            event = client.transport.events[0]
            assert event["exception"]["values"][0]["mechanism"]["handled"] is False
            assert event["tags"]["source"] == "excepthook"
            assert seen == [err]  # the previous hook still ran
        finally:
            uninstall()
    finally:
        sys.excepthook = original


def test_excepthook_skips_keyboard_interrupt_but_still_chains():
    seen: List[BaseException] = []
    original = sys.excepthook
    sys.excepthook = lambda t, e, tb: seen.append(e)
    try:
        client = make_client()
        uninstall = install_lifecycle_hooks(client)
        try:
            _raise_via_hook(KeyboardInterrupt())
            assert client.transport.events == []
            assert len(seen) == 1
        finally:
            uninstall()
    finally:
        sys.excepthook = original


def test_capture_at_exit_false_leaves_excepthook_alone():
    original = sys.excepthook
    client = make_client(capture_at_exit=False)
    uninstall = install_lifecycle_hooks(client)
    try:
        assert sys.excepthook is original
    finally:
        uninstall()


def test_uninstall_restores_previous_hook():
    original = sys.excepthook
    client = make_client()
    uninstall = install_lifecycle_hooks(client)
    assert sys.excepthook is not original
    uninstall()
    assert sys.excepthook is original


def test_atexit_flush_uses_shutdown_timeout(monkeypatch):
    registered: List[Any] = []
    monkeypatch.setattr("dispatchitapp.lifecycle.atexit.register", registered.append)
    monkeypatch.setattr("dispatchitapp.lifecycle.atexit.unregister", lambda fn: None)

    client = make_client(shutdown_timeout=1.5)
    uninstall = install_lifecycle_hooks(client)
    try:
        assert len(registered) == 1
        registered[0]()  # simulate process exit
        assert client.transport.flush_calls == [1.5]
    finally:
        uninstall()


def test_atexit_flush_skipped_when_shutdown_timeout_zero(monkeypatch):
    registered: List[Any] = []
    monkeypatch.setattr("dispatchitapp.lifecycle.atexit.register", registered.append)
    monkeypatch.setattr("dispatchitapp.lifecycle.atexit.unregister", lambda fn: None)

    client = make_client(shutdown_timeout=0)
    uninstall = install_lifecycle_hooks(client)
    try:
        registered[0]()
        assert client.transport.flush_calls == []
    finally:
        uninstall()


def test_init_installs_hooks_by_default_and_opt_out():
    # Clear hooks left by other tests' init() calls, then capture the true baseline.
    dispatchitapp.init(api_key="x", environment="dev", install_lifecycle_hooks=False)
    original = sys.excepthook
    try:
        dispatchitapp.init(api_key="x", environment="production")
        assert sys.excepthook is not original

        # Re-init with opt-out: previous hooks are removed, none installed.
        dispatchitapp.init(
            api_key="x", environment="production", install_lifecycle_hooks=False
        )
        assert sys.excepthook is original
    finally:
        dispatchitapp.init(api_key="x", environment="dev", install_lifecycle_hooks=False)
        sys.excepthook = original
