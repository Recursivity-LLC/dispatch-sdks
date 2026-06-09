from dispatch_sdk.dedup import already_captured, mark_captured


def test_marks_once():
    err = ValueError("boom")
    assert already_captured(err) is False
    mark_captured(err)
    assert already_captured(err) is True


def test_distinct_instances_independent():
    a = ValueError("a")
    b = ValueError("b")
    mark_captured(a)
    assert already_captured(b) is False
