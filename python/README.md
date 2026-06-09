# python/

The Python SDK — `dispatch-sdk` on PyPI. A single distribution with framework **extras**
(`pip install dispatch-sdk[django]`), not a constellation of packages.

Landing in **Phase 1+** (server-side first, per the approved plan):

```
python/dispatch-sdk/
  pyproject.toml            # hatchling; extras: django / flask / fastapi / celery
  src/dispatch_sdk/
    __init__.py             # init(), capture_exception(), report()
    config.py event.py types.py sampling.py dedup.py reporter.py
    stacktrace.py           # traceback module → frames (in_app excludes site-packages/stdlib)
    source_context.py       # linecache
    transport.py            # background thread + queue.Queue(maxsize=100)  ← port of transport.rb
    integrations/
      wsgi.py asgi.py django.py flask.py fastapi.py
      celery.py             # task_failure signal   (background-error analogue)
      logging.py            # logging.Handler        (Rails.error analogue)
```

Core is **stdlib-only** so a no-extras install is a viable manual-capture-only SDK (the
`errors_only` analogue). Tests: pytest + responses/respx, a nox matrix over framework versions,
mypy `--strict`, Ruff. Min Python 3.9.

The target output shape is `../contract/fixtures/event.python-traceback.json`; logic is ported
from the gem's `lib/dispatch/rails/` and the wire shape is pinned by `../contract`.
