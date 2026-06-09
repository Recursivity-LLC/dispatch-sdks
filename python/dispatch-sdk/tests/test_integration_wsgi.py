import pytest
from _fakes import make_fake_client

from dispatch_sdk.integrations.wsgi import DispatchWSGIMiddleware


def base_environ():
    return {
        "REQUEST_METHOD": "POST",
        "PATH_INFO": "/orders/42",
        "QUERY_STRING": "ref=email",
        "wsgi.url_scheme": "https",
        "HTTP_HOST": "shop.example.com",
        "HTTP_USER_AGENT": "UA/1.0",
        "HTTP_X_REQUEST_ID": "req-1",
        "REMOTE_ADDR": "203.0.113.7",
        "HTTP_COOKIE": "secret=leak",
    }


def test_captures_and_reraises():
    client = make_fake_client()

    def app(environ, start_response):
        raise RuntimeError("boom")

    mw = DispatchWSGIMiddleware(app, client=client)
    with pytest.raises(RuntimeError):
        mw(base_environ(), lambda *a: None)

    assert len(client.transport.events) == 1
    event = client.transport.events[0]
    assert event["exception"]["values"][0]["mechanism"]["handled"] is False
    req = event["request"]
    assert req["url"] == "https://shop.example.com/orders/42"
    assert req["method"] == "POST"
    assert req["query_string"] == "ref=email"
    assert req["headers"]["User-Agent"] == "UA/1.0"
    assert req["headers"]["X-Request-Id"] == "req-1"
    assert "Cookie" not in req["headers"]
    assert req["env"]["REMOTE_ADDR"] == "203.0.113.7"


def test_passthrough_when_no_error():
    client = make_fake_client()

    def app(environ, start_response):
        return [b"ok"]

    mw = DispatchWSGIMiddleware(app, client=client)
    assert list(mw(base_environ(), lambda *a: None)) == [b"ok"]
    assert client.transport.events == []
