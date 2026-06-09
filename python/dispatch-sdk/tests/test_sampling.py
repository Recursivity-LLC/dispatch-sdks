from dispatch_sdk.sampling import sampled_out


def test_keeps_everything_at_rate_ge_1():
    assert sampled_out(1, lambda: 0.999999) is False
    assert sampled_out(2, lambda: 0.999999) is False


def test_drops_everything_at_rate_le_0():
    assert sampled_out(0, lambda: 0.0) is True
    assert sampled_out(-1, lambda: 0.0) is True


def test_keeps_when_rng_le_rate():
    assert sampled_out(0.5, lambda: 0.4) is False
    assert sampled_out(0.5, lambda: 0.6) is True
