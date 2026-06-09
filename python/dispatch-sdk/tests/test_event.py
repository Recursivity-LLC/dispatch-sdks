from dispatch_sdk.config import resolve_config
from dispatch_sdk.event import build_event

config = resolve_config(
    "dsp_live_x", environment="production", release="9f8c2a1d", tags={"service": "checkout"}
)
FIXED = {"now": lambda: 1700000000.0, "uuid": lambda: "0" * 32}


def _simple_error():
    try:
        raise RuntimeError("boom")
    except RuntimeError as err:
        return err


def _chain():
    try:
        try:
            try:
                raise ValueError("root")
            except ValueError as e1:
                raise RuntimeError("mid") from e1
        except RuntimeError as e2:
            raise Exception("top") from e2
    except Exception as e3:
        return e3


def test_builds_sentry_shaped_event():
    event = build_event(_simple_error(), config=config, handled=True, **FIXED)
    assert event["event_id"] == "0" * 32
    assert event["timestamp"] == 1700000000.0
    assert event["platform"] == "python"
    assert event["level"] == "error"
    assert event["environment"] == "production"
    assert event["release"] == "9f8c2a1d"
    assert event["sdk"]["name"] == "dispatch-python"
    values = event["exception"]["values"]
    assert len(values) == 1
    assert values[0]["type"] == "RuntimeError"
    assert values[0]["value"] == "boom"
    assert values[0]["mechanism"] == {"type": "generic", "handled": True}


def test_cause_chain_oldest_first():
    event = build_event(_chain(), config=config, handled=False, **FIXED)
    values = event["exception"]["values"]
    assert [v["value"] for v in values] == ["root", "mid", "top"]
    assert [v["type"] for v in values] == ["ValueError", "RuntimeError", "Exception"]
    assert all(v["mechanism"]["handled"] is False for v in values)


def test_truncates_message_to_2000():
    try:
        raise Exception("x" * 2500)
    except Exception as err:
        event = build_event(err, config=config, handled=True, **FIXED)
    assert len(event["exception"]["values"][0]["value"]) == 2000


def test_merges_tags_explicit_wins():
    event = build_event(
        _simple_error(),
        config=config,
        handled=True,
        transaction="orders#update",
        tags={"service": "override", "area": "import"},
        **FIXED,
    )
    assert event["transaction"] == "orders#update"
    assert event["tags"]["transaction"] == "orders#update"
    assert event["tags"]["service"] == "override"
    assert event["tags"]["area"] == "import"


def test_omits_absent_optional_fields():
    minimal = resolve_config("x", environment="production")
    event = build_event(_simple_error(), config=minimal, handled=True, **FIXED)
    assert "release" not in event
    assert "server_name" not in event
    assert "user" not in event
