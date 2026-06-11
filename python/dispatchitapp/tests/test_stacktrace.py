import os

from dispatchitapp.stacktrace import frames_from_traceback

HERE = os.path.dirname(__file__)


def _raise_deep():
    raise ValueError("boom")  # the failing line


def _raise_mid():
    _raise_deep()


def test_frames_oldest_first_with_source_context():
    try:
        _raise_mid()
    except ValueError as err:
        frames = frames_from_traceback(err.__traceback__, HERE)

    # oldest first: this test -> _raise_mid -> _raise_deep (where it threw, last)
    assert [f["function"] for f in frames][-2:] == ["_raise_mid", "_raise_deep"]

    failing = frames[-1]
    assert failing["function"] == "_raise_deep"
    assert failing["in_app"] is True
    assert "context_line" in failing
    assert 'raise ValueError("boom")' in failing["context_line"]
    assert isinstance(failing["pre_context"], list)
    assert isinstance(failing["post_context"], list)


def test_relative_filename_under_project_root():
    try:
        _raise_deep()
    except ValueError as err:
        frames = frames_from_traceback(err.__traceback__, HERE)
    # filename is relative to the given project root
    assert frames[-1]["filename"] == "test_stacktrace.py"
