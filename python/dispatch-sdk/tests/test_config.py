from dispatch_sdk.config import (
    configured,
    derive_error_endpoint,
    derive_report_base_url,
    environment_enabled,
    error_tracking_enabled,
    resolve_config,
)


def test_derive_error_endpoint_swaps_last_segment():
    assert (
        derive_error_endpoint("https://dispatchit.app/api/v1/tickets")
        == "https://dispatchit.app/api/v1/store"
    )
    assert (
        derive_error_endpoint("https://acme.dispatchit.app/api/v1/tickets")
        == "https://acme.dispatchit.app/api/v1/store"
    )


def test_derive_report_base_url():
    assert (
        derive_report_base_url("https://acme.dispatchit.app/api/v1/tickets")
        == "https://acme.dispatchit.app"
    )
    assert derive_report_base_url("not a url") is None


def test_defaults():
    c = resolve_config("dsp_live_x")
    assert c.endpoint == "https://dispatchit.app/api/v1/tickets"
    assert c.error_endpoint == "https://dispatchit.app/api/v1/store"
    assert c.enabled_environments == ["production", "staging"]
    assert c.error_sample_rate == 1.0
    assert c.capture_exceptions is True
    assert c.sdk_name == "dispatch-python"


def test_explicit_error_endpoint_override():
    c = resolve_config("x", error_endpoint="https://eu.example/ingest")
    assert c.error_endpoint == "https://eu.example/ingest"


def test_gating():
    prod = resolve_config("x", environment="production")
    assert configured(prod) and environment_enabled(prod) and error_tracking_enabled(prod)

    dev = resolve_config("x", environment="development")
    assert environment_enabled(dev) is False

    allenv = resolve_config("x", environment="development", enabled_environments=[])
    assert environment_enabled(allenv) is True

    off = resolve_config("x", environment="production", capture_exceptions=False)
    assert error_tracking_enabled(off) is False

    nokey = resolve_config("")
    assert configured(nokey) is False
