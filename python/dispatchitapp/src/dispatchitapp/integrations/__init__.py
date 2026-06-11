"""Runtime/framework integrations.

Phase 2 (runtime hooks, the Rails.error analogues):
  * logging.DispatchHandler — a logging.Handler that captures records carrying an exception.
  * celery.install         — connect to Celery's task_failure signal (requires the [celery] extra).

Phase 3 will add WSGI/ASGI + Django/Flask/FastAPI middleware here.
"""
