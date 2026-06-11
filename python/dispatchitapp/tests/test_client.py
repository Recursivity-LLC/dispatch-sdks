from typing import Any, Dict, List, Optional

from dispatchitapp.client import Client
from dispatchitapp.transport import Transport


class FakeTransport(Transport):
    def __init__(self, config):
        super().__init__(config, post_func=lambda *_: (200, "{}"))
        self.events: List[Dict[str, Any]] = []
        self.tickets: List[Dict[str, Any]] = []
        self.ticket_response: Optional[Dict[str, Any]] = {
            "id": 1,
            "status": "inbox",
            "url": "https://x/1",
        }

    def send_event(self, event):
        self.events.append(event)

    def post_ticket(self, payload):
        self.tickets.append(payload)
        return self.ticket_response

    def flush(self, timeout: float = 2.0) -> bool:
        return True


def make_client(**overrides):
    opts = {"api_key": "dsp_live_x", "environment": "production"}
    opts.update(overrides)
    client = Client(**opts)
    fake = FakeTransport(client.config)
    client.transport = fake
    return client, fake


def _error(message="boom"):
    try:
        raise RuntimeError(message)
    except RuntimeError as err:
        return err


def test_captures_handled_by_default():
    client, fake = make_client()
    client.capture_exception(_error())
    assert len(fake.events) == 1
    assert fake.events[0]["exception"]["values"][0]["mechanism"]["handled"] is True


def test_marks_unhandled_when_requested():
    client, fake = make_client()
    client.capture_exception(_error(), handled=False, transaction="orders#update")
    assert fake.events[0]["exception"]["values"][0]["mechanism"]["handled"] is False
    assert fake.events[0]["transaction"] == "orders#update"


def test_dedup_same_instance():
    client, fake = make_client()
    err = _error()
    client.capture_exception(err)
    client.capture_exception(err)
    assert len(fake.events) == 1


def test_drops_at_sample_rate_zero():
    client, fake = make_client(error_sample_rate=0)
    client.capture_exception(_error())
    assert fake.events == []


def test_before_send_drop_and_mutate():
    dropped, dfake = make_client(before_send=lambda e: None)
    dropped.capture_exception(_error())
    assert dfake.events == []

    def scrub(e):
        e["environment"] = "scrubbed"
        return e

    mutated, mfake = make_client(before_send=scrub)
    mutated.capture_exception(_error())
    assert mfake.events[0]["environment"] == "scrubbed"


def test_disabled_environment_and_capture_flag():
    dev, dfake = make_client(environment="development")
    dev.capture_exception(_error())
    assert dfake.events == []

    off, offake = make_client(capture_exceptions=False)
    off.capture_exception(_error())
    assert offake.events == []


def test_never_raises_on_no_active_exception():
    client, fake = make_client()
    client.capture_exception()  # no current exception
    assert fake.events == []


def test_report_posts_and_returns_response():
    client, fake = make_client()
    res = client.report(description="Nightly import aborted", severity="high")
    assert res == {"id": 1, "status": "inbox", "url": "https://x/1"}
    assert fake.tickets[0]["ticket"]["description"] == "Nightly import aborted"


def test_report_none_when_unconfigured():
    client, fake = make_client(api_key="")
    assert client.report(description="x") is None
    assert fake.tickets == []
