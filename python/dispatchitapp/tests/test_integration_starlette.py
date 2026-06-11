import pytest

pytest.importorskip("starlette")
pytest.importorskip("httpx")

from _fakes import init_default_fake  # noqa: E402
from starlette.applications import Starlette  # noqa: E402
from starlette.routing import Route  # noqa: E402
from starlette.testclient import TestClient  # noqa: E402

from dispatchitapp.integrations.asgi import DispatchASGIMiddleware  # noqa: E402


async def _boom(request):  # noqa: ANN001, ANN202
    raise RuntimeError("kaboom")


def test_starlette_asgi_captures():
    client = init_default_fake()
    app = Starlette(routes=[Route("/orders/{oid}", _boom, methods=["POST"])])
    app.add_middleware(DispatchASGIMiddleware)

    test_client = TestClient(app, raise_server_exceptions=False)
    response = test_client.post("/orders/42?ref=email", headers={"host": "shop.example.com"})

    assert response.status_code == 500
    events = client.transport.events
    assert len(events) == 1
    event = events[0]
    assert event["exception"]["values"][0]["mechanism"]["handled"] is False
    assert event["request"]["method"] == "POST"
    assert "/orders/42" in event["request"]["url"]
