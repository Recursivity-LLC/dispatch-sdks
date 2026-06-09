# @dispatch/core

The framework-agnostic core of the [Dispatch](https://dispatchit.app) SDKs: configuration,
the Sentry-shaped event builder, client-side sampling, dedup, the `before_send` hook, the
ticket/report client, and a bounded async transport.

On its own it's a usable **minimal SDK** — manual exception capture and programmatic bug
reports — anywhere a global `fetch` exists (Node 18+, modern browsers). Runtime packages build
on it: `@dispatch/node` (source context, global handlers, flush-on-exit), `@dispatch/browser`
(the error tracker + bug-report widget), and the framework adapters.

```ts
import { init, captureException, report, flush } from "@dispatch/core";

init({
  apiKey: process.env.DISPATCH_API_KEY!,
  environment: process.env.NODE_ENV,
  release: process.env.GIT_SHA,
});

try {
  doRiskyThing();
} catch (err) {
  captureException(err, { tags: { area: "import" } });
}

// File a curated report (the API-only analogue of the widget):
await report({ description: "Nightly import aborted: upstream 502", severity: "high" });

await flush(); // before the process exits
```

## What's in the box

| Module | Role |
| --- | --- |
| `config` | Options → resolved config, with the gem's derivations (`errorEndpoint`, `reportBaseUrl`, env gating). |
| `event` | `buildEvent(error)` → the contract event; cause chain (≤5, oldest-first), `mechanism.handled`, 2000-char message cap. |
| `stacktrace` | Portable V8 + SpiderMonkey/JSC stack parser, frames oldest-first, `in_app` heuristic. |
| `ticket` | `buildTicketPayload()` → the `{ ticket }` body, `correlationId` → `metadata.correlation_id`. |
| `transport` | `FetchTransport`: bounded queue (100, drop-on-overflow), Bearer + `X-Dispatch-Sdk` headers, never throws. |
| `sampling` / `dedup` | `rand > rate` sampling; WeakSet identity dedup. |
| `client` | The capture pipeline: gate → dedup → sample → build → `before_send` → deliver. Never throws. |

The wire shape is pinned by `../../contract`; `test/conformance.test.ts` validates core's output
against those schemas.

## Scripts

```bash
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit (strict)
pnpm build       # tsup → ESM + CJS + d.ts
```
