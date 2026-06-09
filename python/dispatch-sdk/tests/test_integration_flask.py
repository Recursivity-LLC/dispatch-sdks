import pytest

pytest.importorskip("flask")

from _fakes import init_default_fake  # noqa: E402
from flask import Flask  # noqa: E402

from dispatch_sdk.integrations.flask import install  # noqa: E402


def test_got_request_exception_captures():
    client = init_default_fake()
    app = Flask(__name__)
    # Render the 500 instead of re-raising, so the signal fires and the client gets a response.
    app.config["PROPAGATE_EXCEPTIONS"] = False

    @app.route("/orders/<oid>", methods=["POST"])
    def orders(oid):  # noqa: ANN001, ANN201
        raise RuntimeError("boom")

    install(app)

    response = app.test_client().post("/orders/42?ref=email", headers={"X-Request-Id": "req-1"})

    assert response.status_code == 500
    events = client.transport.events
    assert len(events) == 1
    event = events[0]
    assert event["exception"]["values"][0]["mechanism"]["handled"] is False
    assert event["transaction"] == "POST /orders/<oid>"
    assert event["request"]["method"] == "POST"
    assert event["request"]["headers"]["X-Request-Id"] == "req-1"
