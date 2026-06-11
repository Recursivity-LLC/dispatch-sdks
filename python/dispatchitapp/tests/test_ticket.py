from dispatchitapp.ticket import build_ticket_payload


def test_minimal_default_source():
    assert build_ticket_payload(description="Nightly import aborted") == {
        "ticket": {"description": "Nightly import aborted", "source": "api"}
    }


def test_folds_correlation_id_into_metadata():
    payload = build_ticket_payload(
        description="boom",
        severity="high",
        metadata={"job": "ImportJob"},
        correlation_id="abc-123",
    )
    assert payload["ticket"]["metadata"] == {"job": "ImportJob", "correlation_id": "abc-123"}
    assert payload["ticket"]["severity"] == "high"


def test_omits_empty_metadata_and_absent_reporter():
    payload = build_ticket_payload(description="x")
    assert "metadata" not in payload["ticket"]
    assert "reporter" not in payload["ticket"]


def test_passes_through_reporter():
    payload = build_ticket_payload(
        description="x", reporter={"email": "casey@example.com", "external_id": "u_99"}
    )
    assert payload["ticket"]["reporter"] == {
        "email": "casey@example.com",
        "external_id": "u_99",
    }
