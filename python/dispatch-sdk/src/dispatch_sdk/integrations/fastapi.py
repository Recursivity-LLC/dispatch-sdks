"""FastAPI / Starlette integration — a thin wrapper that installs the ASGI middleware:

    import dispatch_sdk
    from dispatch_sdk.integrations.fastapi import add_dispatch

    app = FastAPI()
    dispatch_sdk.init(api_key=..., environment="production")
    add_dispatch(app)

(FastAPI is ASGI/Starlette, so DispatchASGIMiddleware does the work — see asgi.py.)"""

from __future__ import annotations

from typing import Any, Optional

from ..client import Client
from .asgi import DispatchASGIMiddleware


def add_dispatch(app: Any, client: Optional[Client] = None) -> Any:
    app.add_middleware(DispatchASGIMiddleware, client=client)
    return app
