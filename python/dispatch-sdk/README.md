# dispatch-sdk (Python)

The Python client for [Dispatch](https://dispatchit.app) — error tracking and curated bug
reports for the AI-native ticketing system.

The **core is stdlib-only**, so a bare `pip install dispatch-sdk` is a viable manual-capture
SDK (the gem's `errors_only` analogue). Framework adapters arrive as extras
(`pip install dispatch-sdk[django]`) in a later phase.

```python
import dispatch_sdk

dispatch_sdk.init(
    api_key=os.environ["DISPATCH_API_KEY"],
    environment=os.environ.get("ENV", "production"),
    release=os.environ.get("GIT_SHA"),
)

try:
    do_risky_thing()
except Exception:
    dispatch_sdk.capture_exception()          # reads the current exception

# File a curated report (the API-only analogue of the widget):
dispatch_sdk.report(description="Nightly import aborted: upstream 502", severity="high")

dispatch_sdk.flush()                            # before the process exits
```

## What's in the box

| Module | Role |
| --- | --- |
| `config` | Options → a frozen `Config`, with the gem's derivations and env gating. |
| `event` | `build_event(exc)` → the contract event; cause chain via `__cause__`/`__context__` (≤5, oldest-first), 2000-char message cap. |
| `stacktrace` | `traceback` → frames (oldest-first), `in_app` excludes site-packages/stdlib, source context via `linecache`. |
| `ticket` | `build_ticket_payload()` → the `{ "ticket": {...} }` body. |
| `transport` | Daemon worker + bounded `queue.Queue(maxsize=100)`, drop-on-overflow, stdlib `urllib`, never raises. |
| `sampling` / `dedup` | `rand > rate` sampling; WeakSet identity dedup. |
| `client` | The capture pipeline: gate → dedup → sample → build → `before_send` → deliver. Never raises. |

The wire shape is pinned by `../../contract`; `tests/test_conformance.py` validates output
against those schemas.

## Develop

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
pytest            # tests
mypy              # strict typing (src)
ruff check .      # lint
```
