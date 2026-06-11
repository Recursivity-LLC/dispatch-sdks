# @dispatchitapp/express

Express error-handler middleware for [Dispatch](https://dispatchit.app). Auto-captures
unhandled route errors with request context, then re-propagates — it never swallows the error.

```ts
import express from "express";
import { init } from "@dispatchitapp/node";
import { errorHandler } from "@dispatchitapp/express";

init({ apiKey: process.env.DISPATCH_API_KEY!, environment: process.env.NODE_ENV });

const app = express();
app.get("/orders/:id", (req, res) => { /* ... */ });

// Register LAST — after routes and any other error handlers.
app.use(errorHandler({
  user: (req) => req.user && { external_id: req.user.id, email: req.user.email },
}));
```

Each captured event carries `handled: false`, the request (`url`, `method`, `query_string`,
allow-listed headers, client IP), the `transaction` (`"POST /orders/:id"` — the matched route
pattern, low cardinality), and the resolved user. The error then continues to Express's default
handler (or yours), so behaviour is unchanged.

Options: `client` (defaults to the `init()` client), `user(req)`, `shouldHandle(err, req)`.
Pairs with [`@dispatchitapp/node`](../node)'s global handlers, which catch anything that escapes the
request lifecycle.
