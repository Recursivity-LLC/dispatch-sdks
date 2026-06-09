# @dispatch/fastify

A Fastify `onError` hook for [Dispatch](https://dispatchit.app). Captures unhandled request
errors with route context — and only observes, so Fastify's own error handling and reply are
unchanged.

```ts
import Fastify from "fastify";
import { init } from "@dispatch/node";
import { dispatchFastify } from "@dispatch/fastify";

init({ apiKey: process.env.DISPATCH_API_KEY!, environment: process.env.NODE_ENV });

const app = Fastify();
await app.register(dispatchFastify, {
  user: (req) => req.user && { external_id: req.user.id, email: req.user.email },
});
```

Or attach the hook directly:

```ts
import { onErrorHook } from "@dispatch/fastify";
app.addHook("onError", onErrorHook({ /* client, user, shouldHandle */ }));
```

Each captured event carries `handled: false`, the request context, the resolved user, and the
`transaction` (`"POST /orders/:id"` — the route pattern from `routeOptions.url`). The plugin is
marked `skip-override` so the hook applies app-wide. Pairs with [`@dispatch/node`](../node)'s
global handlers for anything outside the request lifecycle.
