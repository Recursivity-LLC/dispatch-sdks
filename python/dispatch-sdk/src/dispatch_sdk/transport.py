"""Async delivery off the hot path: a single daemon worker drains a bounded queue and POSTs
each event. Bounded (drop-on-overflow) so a flood can never grow memory without limit. The
HTTP layer is stdlib urllib (no third-party deps); inject `post_func` to test without sockets.
Mirrors the gem's Transport."""

from __future__ import annotations

import json
import queue
import threading
import time
import urllib.error
import urllib.request
from typing import Any, Callable, Dict, Optional, Tuple

from .config import Config
from .version import CONTRACT_VERSION

QUEUE_LIMIT = 100
READ_TIMEOUT = 5

PostResult = Optional[Tuple[int, str]]
PostFunc = Callable[[str, Dict[str, str], bytes], PostResult]


def sdk_header(config: Config) -> str:
    return f"{config.sdk_name}/{config.sdk_version} (contract/{CONTRACT_VERSION})"


def _dump(obj: Any) -> bytes:
    return json.dumps(obj).encode("utf-8")


class Transport:
    def __init__(self, config: Config, post_func: Optional[PostFunc] = None) -> None:
        self.config = config
        self._post: PostFunc = post_func or self._default_post
        self._queue: "queue.Queue[Dict[str, Any]]" = queue.Queue(maxsize=QUEUE_LIMIT)
        self._worker: Optional[threading.Thread] = None
        self._lock = threading.Lock()

    def send_event(self, event: Dict[str, Any]) -> None:
        try:
            self._queue.put_nowait(event)
        except queue.Full:
            self._warn("queue full, dropping event")
            return
        self._ensure_worker()

    def post_ticket(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        result = self._post(self.config.endpoint, self._headers(), _dump(payload))
        if not result:
            return None
        status, text = result
        if not 200 <= status < 300:
            return None
        try:
            parsed = json.loads(text)
            return parsed if isinstance(parsed, dict) else None
        except ValueError:
            return None

    def flush(self, timeout: float = 2.0) -> bool:
        deadline = time.time() + timeout
        while not self._queue.empty() and time.time() < deadline:
            time.sleep(0.005)
        return self._queue.empty()

    def _ensure_worker(self) -> None:
        with self._lock:
            if self._worker is not None and self._worker.is_alive():
                return
            worker = threading.Thread(target=self._run, name="dispatch-transport", daemon=True)
            self._worker = worker
            worker.start()

    def _run(self) -> None:
        while True:
            event = self._queue.get()
            try:
                self._post(self.config.error_endpoint, self._headers(), _dump(event))
            except Exception as err:  # never let a delivery error kill the worker
                self._warn(f"delivery failed: {err}")
            finally:
                self._queue.task_done()

    def _headers(self) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.config.api_key}",
            "X-Dispatch-Sdk": sdk_header(self.config),
        }

    def _default_post(self, url: str, headers: Dict[str, str], body: bytes) -> PostResult:
        request = urllib.request.Request(url, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=READ_TIMEOUT) as response:
                return response.status, response.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as err:
            return err.code, err.read().decode("utf-8", "replace")
        except Exception as err:
            self._warn(f"request failed: {err}")
            return None

    def _warn(self, message: str) -> None:
        if self.config.debug:
            print(f"[dispatch] {message}")
