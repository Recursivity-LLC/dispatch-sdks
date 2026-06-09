# @dispatch/node

The Node.js server SDK for [Dispatch](https://dispatchit.app). Builds on
[`@dispatch/core`](../core), adding the two things a server needs that the core can't do
portably:

- **V8 stack frames with source context** — in-app frames carry the lines around the failing
  line (`pre_context`/`context_line`/`post_context`), read from disk, exactly like the gem.
- **Global error handlers** — `process` `uncaughtException` / `unhandledRejection`, the
  runtime-level analogue of the gem's Rack middleware + `Rails.error` subscriber.

```ts
import { init, captureException, report } from "@dispatch/node";

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

Framework middleware (Express, Fastify) lands in `@dispatch/express` / `@dispatch/fastify` and
builds on this package. Everything from `@dispatch/core` is re-exported here, so a Node app
imports solely from `@dispatch/node`.

## Notes

- `init` sets `platform: "node"`, the `dispatch-node` SDK identity, and a source-context stack
  parser rooted at `cwd` (default `process.cwd()`). `in_app` = under the project root and not in
  `node_modules` / `node:` internals.
- After capturing an `uncaughtException` the handler flushes and, by default, `exit(1)` — the
  process was already in an undefined state. Override with `onFatalError` or `exitOnUncaught: false`.

## Scripts

```bash
pnpm test · pnpm typecheck · pnpm build
```
