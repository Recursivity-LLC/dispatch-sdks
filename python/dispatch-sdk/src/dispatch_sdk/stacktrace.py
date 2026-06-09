"""Turn a traceback into contract frames, with source context for in-app frames.

Python's traceback is already OLDEST FIRST (outermost frame, walking tb_next toward where the
exception was raised), which is exactly the contract's ordering — failing frame last. Source
context comes from linecache (purpose-built for this). Mirrors EventBuilder#frames_for."""

from __future__ import annotations

import linecache
import os
from types import TracebackType
from typing import List, Optional

from .types import Frame

MAX_FRAMES = 100
MAX_CONTEXT_FRAMES = 12
CONTEXT_LINES = 5


def _in_app(path: str, project_root: str) -> bool:
    if not path:
        return False
    if "site-packages" in path or "dist-packages" in path:
        return False
    if "/lib/python" in path or "\\lib\\python" in path:
        return False
    return path.startswith(project_root)


def _relative(path: str, project_root: str) -> str:
    if path and path.startswith(project_root):
        try:
            return os.path.relpath(path, project_root)
        except ValueError:
            return path
    return path


def frames_from_traceback(tb: Optional[TracebackType], project_root: str) -> List[Frame]:
    frames: List[Frame] = []
    current = tb
    while current is not None:
        code = current.tb_frame.f_code
        path = code.co_filename
        frame: Frame = {
            "abs_path": path,
            "filename": _relative(path, project_root),
            "function": code.co_name,
            "lineno": current.tb_lineno,
            "in_app": _in_app(path, project_root),
        }
        frames.append(frame)
        current = current.tb_next

    frames = frames[:MAX_FRAMES]
    _annotate_context(frames)
    return frames


def _annotate_context(frames: List[Frame]) -> None:
    """Add source context to the most-recent in-app frames (the tail), within a budget."""
    budget = MAX_CONTEXT_FRAMES
    for frame in reversed(frames):
        if budget <= 0:
            break
        if not frame.get("in_app"):
            continue
        budget -= 1
        _add_source_context(frame)


def _add_source_context(frame: Frame) -> None:
    path = frame.get("abs_path")
    lineno = frame.get("lineno")
    if not path or not lineno:
        return
    lines = linecache.getlines(path)
    if not lines:
        return
    idx = lineno - 1
    if idx < 0 or idx >= len(lines):
        return
    frame["pre_context"] = [line.rstrip() for line in lines[max(0, idx - CONTEXT_LINES):idx]]
    frame["context_line"] = lines[idx].rstrip()
    frame["post_context"] = [line.rstrip() for line in lines[idx + 1: idx + 1 + CONTEXT_LINES]]
