# Contributing

## The golden rule: the contract comes first

`contract/` is the source of truth. No SDK invents wire shape. If you need a field the contract
doesn't have, change the contract (schema + fixtures + the gem reference producer) in its own PR,
get it reviewed, then implement it in the SDKs. A surprising fixture diff is a signal that the
wire format moved and every SDK must follow.

## Repo shape

- `contract/` — OpenAPI, JSON Schemas, golden fixtures, the validator.
- `packages/` — JS/TS packages (pnpm workspace), published under `@dispatch/*`.
- `python/` — the Python SDK (`dispatch-sdk` on PyPI).
- `conformance/` — the cross-language gate.

The Ruby gem is **not** here — it lives in the product repo and is the reference producer.

## Phases

We build this out in phases (see the design doc in the product repo). Current status:

- **Phase 0 — contract** ✅ schemas, fixtures, validator, regeneration script.
- **Phase 1 — core + minimal client** ✅ `@dispatch/core` (TS) and `dispatch-sdk` (Python):
  config, event builder, sampling, dedup, `before_send`, `report()`, manual capture, bounded
  transport. Both validate their output against the contract schemas.
- **Phase 2 — auto-capture + runtime hooks** ✅ `@dispatch/node` (process global handlers + V8
  stack frames with `fs` source context); Python `integrations.logging.DispatchHandler` +
  `integrations.celery.install` (the Rails.error analogues).
- **Phase 3 — framework middleware** ✅ Node `@dispatch/express` (4-arg error handler) +
  `@dispatch/fastify` (onError hook); Python `integrations/{wsgi,asgi,django,flask,fastapi}` —
  all innermost, capture-and-re-raise with request/route/user context.
- **Phase 4 — browser error tracker** ✅ `@dispatch/browser`: real cross-browser stack parser,
  breadcrumbs + `user_path`, fetch-keepalive→sendBeacon (`?sentry_key=` fallback), window
  error/unhandledrejection handlers, and a self-contained IIFE `<script>` drop-in.
- **Phase 5 — bug-report widget** ✅ `@dispatch/browser/widget`: the `_widget.html.erb` DOM
  rebuilt in framework-free JS (floating 🐞 button, modal, screenshot picker/drag/paste→base64,
  toast), a separate entry + IIFE drop-in, reusing the transport. Matches `ticket.widget.json`.
- **Later** — thin React/Vue wrappers; hardening (browser source maps, structured error
  responses, FastAPI asyncio transport); the 1.0 release on contract v1.

## Adding a language

1. Read `contract/README.md` end to end.
2. Implement the **core** first: config defaults/derivations, the event builder, sampling, dedup,
   `before_send`, the bounded transport. Port the logic from the gem's `lib/dispatch/rails/`
   (`configuration.rb`, `event_builder.rb`, `reporter.rb`, `transport.rb`).
3. Add producer tests that normalize and diff against `contract/fixtures/` (see
   `conformance/normalize.mjs` for the JS normalizer; port its field list).
4. Validate produced payloads against `contract/schema/*.json` in your transport tests.
5. Wire a CI workflow modeled on `.github/workflows/contract.yml`.

## Versioning

Independent semver per package, **shared major == wire-contract version**. Carry the contract
version in `X-Dispatch-Sdk` (e.g. `dispatch-node/1.2.0 (contract/1)`).

## Local checks

```bash
pnpm install
pnpm --filter @dispatch/contract validate   # schema-validate the fixtures
```
