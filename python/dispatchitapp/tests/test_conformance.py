"""Ties dispatchitapp to the wire contract: events/tickets it produces must validate against
contract/schema/*.json. If this fails, the SDK has drifted from the contract."""

import json
from pathlib import Path

from jsonschema import Draft202012Validator

from dispatchitapp.config import resolve_config
from dispatchitapp.event import build_event
from dispatchitapp.ticket import build_ticket_payload

REPO_ROOT = Path(__file__).resolve().parents[3]
SCHEMA_DIR = REPO_ROOT / "contract" / "schema"


def _validator(name):
    schema = json.loads((SCHEMA_DIR / name).read_text())
    return Draft202012Validator(schema)


event_validator = _validator("event.schema.json")
ticket_validator = _validator("ticket.schema.json")

config = resolve_config("dsp_live_x", environment="production", release="9f8c2a1d")
FIXED = {"now": lambda: 1700000000.0, "uuid": lambda: "0" * 32}


def _error(message="boom"):
    try:
        raise ValueError(message)
    except ValueError as err:
        return err


def _chain():
    try:
        try:
            raise ValueError("root")
        except ValueError as e1:
            raise RuntimeError("top") from e1
    except RuntimeError as e2:
        return e2


def test_simple_event_conforms():
    event = build_event(_error(), config=config, handled=True, **FIXED)
    event_validator.validate(event)


def test_unhandled_event_with_transaction_conforms():
    event = build_event(
        _error(), config=config, handled=False, transaction="orders.views.update", **FIXED
    )
    event_validator.validate(event)


def test_cause_chain_event_conforms():
    event = build_event(_chain(), config=config, handled=False, **FIXED)
    assert len(event["exception"]["values"]) == 2
    event_validator.validate(event)


def test_ticket_payloads_conform():
    widget_like = build_ticket_payload(
        description="When I clicked Save, the page 500'd",
        source="widget",
        severity="high",
        reporter={"email": "casey@example.com", "external_id": "u_99"},
        metadata={"url": "https://shop.example.com/checkout", "labels": ["checkout"]},
    )
    api_report = build_ticket_payload(
        description="Nightly import aborted",
        severity="high",
        metadata={"job": "ImportJob"},
        correlation_id="abc-123",
    )
    ticket_validator.validate(widget_like)
    ticket_validator.validate(api_report)
