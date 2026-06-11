"""Shared test helpers."""

from dispatchitapp.client import Client
from dispatchitapp.transport import Transport


class FakeTransport(Transport):
    def __init__(self, config):
        super().__init__(config, post_func=lambda *_: (200, "{}"))
        self.events = []

    def send_event(self, event):
        self.events.append(event)


def make_fake_client(**opts):
    opts.setdefault("api_key", "x")
    opts.setdefault("environment", "production")
    client = Client(**opts)
    client.transport = FakeTransport(client.config)
    return client


def init_default_fake(**opts):
    """Initialise the module-level default client with a recording transport."""
    import dispatchitapp

    merged = {"api_key": "x", "environment": "production"}
    merged.update(opts)
    client = dispatchitapp.init(**merged)
    client.transport = FakeTransport(client.config)
    return client
