import json
import threading

from dispatch_sdk.config import resolve_config
from dispatch_sdk.transport import QUEUE_LIMIT, Transport

config = resolve_config("dsp_live_secret", environment="production")


def _event(event_id):
    return {
        "event_id": event_id,
        "timestamp": 1700000000.0,
        "platform": "python",
        "level": "error",
        "environment": "production",
        "exception": {"values": []},
    }


def test_delivers_events_with_auth_and_sdk_headers():
    calls = []
    done = threading.Event()

    def post_func(url, headers, body):
        calls.append((url, headers, json.loads(body)))
        done.set()
        return (200, "{}")

    t = Transport(config, post_func=post_func)
    t.send_event(_event("e1"))
    assert done.wait(2)
    t.flush()

    url, headers, body = calls[0]
    assert url == "https://dispatchit.app/api/v1/store"
    assert headers["Authorization"] == "Bearer dsp_live_secret"
    assert headers["X-Dispatch-Sdk"].startswith("dispatch-python/")
    assert "(contract/1)" in headers["X-Dispatch-Sdk"]
    assert body["event_id"] == "e1"


def test_post_ticket_returns_parsed_response():
    def post_func(url, headers, body):
        assert url == "https://dispatchit.app/api/v1/tickets"
        return (201, json.dumps({"id": 42, "status": "inbox", "url": "https://x/42"}))

    t = Transport(config, post_func=post_func)
    assert t.post_ticket({"ticket": {"description": "boom"}}) == {
        "id": 42,
        "status": "inbox",
        "url": "https://x/42",
    }


def test_post_ticket_none_on_non_2xx_or_no_response():
    t1 = Transport(config, post_func=lambda *_: (422, "{}"))
    assert t1.post_ticket({"ticket": {"description": "x"}}) is None

    t2 = Transport(config, post_func=lambda *_: None)
    assert t2.post_ticket({"ticket": {"description": "x"}}) is None


def test_flush_waits_for_the_in_flight_event():
    gate = threading.Event()
    entered = threading.Event()

    def post_func(url, headers, body):
        entered.set()  # popped from the queue; POST now in flight
        gate.wait(2)
        return (200, "{}")

    t = Transport(config, post_func=post_func)
    t.send_event(_event("e1"))
    assert entered.wait(2)
    # Queue is empty but the event hasn't been delivered — flush must not claim success.
    assert t.flush(timeout=0.1) is False
    gate.set()
    assert t.flush(timeout=2) is True


def test_bounds_queue_dropping_overflow():
    gate = threading.Event()
    entered = threading.Event()
    lock = threading.Lock()
    calls = []

    def post_func(url, headers, body):
        with lock:
            calls.append(url)
        entered.set()  # the first call has been popped and is now in-flight
        gate.wait(2)  # ...and holds the worker until we've flooded the queue
        return (200, "{}")

    t = Transport(config, post_func=post_func)
    # Park exactly one event in-flight before flooding, so the queue fills deterministically.
    t.send_event(_event("e0"))
    assert entered.wait(2)
    for i in range(1, QUEUE_LIMIT + 50):
        t.send_event(_event(f"e{i}"))

    gate.set()
    assert t.flush(timeout=3) is True
    # one in-flight + QUEUE_LIMIT queued were accepted; the rest dropped.
    assert len(calls) == QUEUE_LIMIT + 1
