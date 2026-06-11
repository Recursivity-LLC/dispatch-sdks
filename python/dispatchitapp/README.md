# dispatchitapp (Python)

The Python client for [Dispatch](https://dispatchit.app) — error tracking and curated bug
reports for the AI-native ticketing system.

The **core is stdlib-only**, so a bare `pip install dispatchitapp` is a viable manual-capture
SDK (the gem's `errors_only` analogue). Framework adapters arrive as extras
(`pip install dispatchitapp[django]`) in a later phase.

```python
import dispatchitapp

dispatchitapp.init(
    api_key=os.environ["DISPATCH_API_KEY"],
    environment=os.environ.get("ENV", "production"),
    release=os.environ.get("GIT_SHA"),
)

try:
    do_risky_thing()
except Exception:
    dispatchitapp.capture_exception()          # reads the current exception

# File a curated report (the API-only analogue of the widget):
dispatchitapp.report(description="Nightly import aborted: upstream 502", severity="high")
```

### Process lifecycle (crash capture + shutdown flush)

`init()` installs the gem's `at_exit` analogues by default:

- **`sys.excepthook`** — the exception about to kill the process (a crashing script,
  runner, or worker boot) is reported with `source: excepthook`, then chained to the
  previous hook so the native traceback still prints. `KeyboardInterrupt` is skipped —
  SIGINT is how process managers ask for a graceful stop, the gem's SIGTERM rule.
- **`atexit` flush** — the send queue drains at exit (up to `shutdown_timeout` seconds,
  default 3.0; 0 skips) so shutdowns don't drop just-captured events. An explicit
  `dispatchitapp.flush()` is no longer needed before exit.

Opt out per hook with `capture_at_exit=False` / `shutdown_timeout=0`, or skip both with
`init(..., install_lifecycle_hooks=False)`.

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
| `lifecycle` | `sys.excepthook` crash capture + `atexit` queue flush (the gem's `at_exit` analogue). |

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
