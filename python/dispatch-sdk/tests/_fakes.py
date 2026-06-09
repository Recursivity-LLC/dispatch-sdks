"""Shared test helpers."""

from dispatch_sdk.client import Client
from dispatch_sdk.transport import Transport


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
    import dispatch_sdk

    merged = {"api_key": "x", "environment": "production"}
    merged.update(opts)
    client = dispatch_sdk.init(**merged)
    client.transport = FakeTransport(client.config)
    return client
