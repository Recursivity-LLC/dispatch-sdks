import asyncio

import pytest
from _fakes import make_fake_client

from dispatchitapp.integrations.asgi import DispatchASGIMiddleware


async def _receive():
    return {"type": "http.request"}


async def _send(_message):
    return None


def http_scope():
    return {
        "type": "http",
        "method": "POST",
        "path": "/orders/42",
        "query_string": b"ref=email",
        "scheme": "https",
        "headers": [
            (b"host", b"shop.example.com"),
            (b"user-agent", b"UA/1.0"),
            (b"x-request-id", b"req-1"),
        ],
        "client": ("203.0.113.7", 4444),
    }


def test_captures_and_reraises():
    client = make_fake_client()

    async def app(scope, receive, send):
        raise RuntimeError("boom")

    mw = DispatchASGIMiddleware(app, client=client)
    with pytest.raises(RuntimeError):
        asyncio.run(mw(http_scope(), _receive, _send))

    assert len(client.transport.events) == 1
    event = client.transport.events[0]
    assert event["exception"]["values"][0]["mechanism"]["handled"] is False
    req = event["request"]
    assert req["url"] == "https://shop.example.com/orders/42"
    assert req["method"] == "POST"
    assert req["query_string"] == "ref=email"
    assert req["headers"]["Host"] == "shop.example.com"
    assert req["env"]["REMOTE_ADDR"] == "203.0.113.7"


def test_non_http_passes_through():
    client = make_fake_client()
    seen = {}

    async def app(scope, receive, send):
        seen["called"] = True

    mw = DispatchASGIMiddleware(app, client=client)
    asyncio.run(mw({"type": "lifespan"}, _receive, _send))
    assert seen.get("called") is True
    assert client.transport.events == []
