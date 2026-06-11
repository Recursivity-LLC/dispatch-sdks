import pytest

# Celery is an optional extra; skip when it isn't installed.
pytest.importorskip("celery")

from celery.signals import task_failure  # noqa: E402

from dispatchitapp.client import Client  # noqa: E402
from dispatchitapp.integrations.celery import install  # noqa: E402
from dispatchitapp.transport import Transport  # noqa: E402


class FakeTransport(Transport):
    def __init__(self, config):
        super().__init__(config, post_func=lambda *_: (200, "{}"))
        self.events = []

    def send_event(self, event):
        self.events.append(event)


class _Sender:
    name = "app.tasks.import_orders"


def test_task_failure_is_captured():
    client = Client(api_key="x", environment="production")
    client.transport = FakeTransport(client.config)
    handler = install(client)
    try:
        try:
            raise RuntimeError("task blew up")
        except RuntimeError as err:
            task_failure.send(
                sender=_Sender(), task_id="abc-123", exception=err, einfo=None
            )
        assert len(client.transport.events) == 1
        event = client.transport.events[0]
        assert event["exception"]["values"][0]["mechanism"]["handled"] is False
        assert event["transaction"] == "app.tasks.import_orders"
        assert event["tags"]["task_id"] == "abc-123"
    finally:
        task_failure.disconnect(handler)
