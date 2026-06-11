# @dispatchitapp/node

The Node.js server SDK for [Dispatch](https://dispatchit.app). Builds on
[`@dispatchitapp/core`](../core), adding the two things a server needs that the core can't do
portably:

- **V8 stack frames with source context** — in-app frames carry the lines around the failing
  line (`pre_context`/`context_line`/`post_context`), read from disk, exactly like the gem.
- **Global error handlers** — `process` `uncaughtException` / `unhandledRejection`, the
  runtime-level analogue of the gem's Rack middleware + `Rails.error` subscriber.

```ts
import { init, captureException, report } from "@dispatchitapp/node";

init({
  apiKey: process.env.DISPATCH_API_KEY!,
  environment: process.env.NODE_ENV,
  release: process.env.GIT_SHA,
  // installGlobalHandlers: true (default) — capture uncaught errors + rejections
});

try {
  doRiskyThing();
} catch (err) {
  captureException(err, { tags: { area: "import" } });
}
```

Framework middleware (Express, Fastify) lands in `@dispatchitapp/express` / `@dispatchitapp/fastify` and
builds on this package. Everything from `@dispatchitapp/core` is re-exported here, so a Node app
imports solely from `@dispatchitapp/node`.

## Notes

- `init` sets `platform: "node"`, the `dispatch-node` SDK identity, and a source-context stack
  parser rooted at `cwd` (default `process.cwd()`). `in_app` = under the project root and not in
  `node_modules` / `node:` internals.
- The handlers preserve Node's native crash behavior — capture, then print the error and
  `exit(1)` (registering a listener would otherwise suppress both). `uncaughtException`:
  override with `onFatalError` or `exitOnUncaught: false`. `unhandledRejection`: fatal by
  default exactly like Node's own `--unhandled-rejections=throw`; opt out with
  `exitOnUnhandledRejection: false` (this keeps the process alive, which Node alone would not).
- Shutdown flush: the event queue drains on `beforeExit` and before any fatal exit, budgeted by
  `shutdownTimeout` (ms, default 3000; the gem's `shutdown_timeout` analogue). Disable the
  `beforeExit` hook with `flushOnBeforeExit: false`. Fatal events are tagged
  `source: uncaughtException` / `unhandledRejection` (the gem's `at_exit` / `rake` analogues).

## Scripts

```bash
pnpm test · pnpm typecheck · pnpm build
```
