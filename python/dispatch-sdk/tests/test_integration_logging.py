import logging

from dispatch_sdk.client import Client
from dispatch_sdk.integrations.logging import DispatchHandler, map_level
from dispatch_sdk.transport import Transport


class FakeTransport(Transport):
    def __init__(self, config):
        super().__init__(config, post_func=lambda *_: (200, "{}"))
        self.events = []

    def send_event(self, event):
        self.events.append(event)


def make_client():
    client = Client(api_key="x", environment="production")
    client.transport = FakeTransport(client.config)
    return client


def _logger(name, client):
    logger = logging.getLogger(name)
    logger.handlers = []
    logger.propagate = False
    logger.setLevel(logging.ERROR)
    logger.addHandler(DispatchHandler(client))
    return logger


def test_map_level():
    assert map_level(logging.CRITICAL) == "fatal"
    assert map_level(logging.ERROR) == "error"
    assert map_level(logging.WARNING) == "warning"
    assert map_level(logging.INFO) == "info"
    assert map_level(5) == "debug"


def test_captures_exception_records():
    client = make_client()
    logger = _logger("test.dispatch.logging", client)
    try:
        raise ValueError("boom")
    except ValueError:
        logger.exception("something failed")

    assert len(client.transport.events) == 1
    event = client.transport.events[0]
    assert event["exception"]["values"][0]["type"] == "ValueError"
    assert event["exception"]["values"][0]["mechanism"]["handled"] is False
    assert event["level"] == "error"
    assert event["tags"]["logger"] == "test.dispatch.logging"


def test_ignores_records_without_exception():
    client = make_client()
    logger = _logger("test.dispatch.logging2", client)
    logger.error("no exception attached")
    assert client.transport.events == []
