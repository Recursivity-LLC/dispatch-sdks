import pytest

django = pytest.importorskip("django")

from django.conf import settings  # noqa: E402

if not settings.configured:
    settings.configure(
        DEBUG=True,
        ALLOWED_HOSTS=["*"],
        DATABASES={},
        INSTALLED_APPS=[],
        MIDDLEWARE=[],
    )
    django.setup()

from _fakes import init_default_fake  # noqa: E402
from django.test import RequestFactory  # noqa: E402

from dispatch_sdk.integrations.django import DispatchMiddleware  # noqa: E402


def test_process_exception_captures():
    client = init_default_fake()
    request = RequestFactory().post("/orders/42?ref=email", HTTP_HOST="shop.example.com")

    middleware = DispatchMiddleware(lambda r: None)
    result = middleware.process_exception(request, RuntimeError("boom"))

    assert result is None  # Django continues its own handling
    events = client.transport.events
    assert len(events) == 1
    event = events[0]
    assert event["exception"]["values"][0]["mechanism"]["handled"] is False
    assert event["request"]["method"] == "POST"
    assert "/orders/42" in event["request"]["url"]
    assert event["transaction"] == "POST /orders/42"
