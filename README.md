# dispatch-sdks

Client SDKs for [Dispatch](https://dispatchit.app), the AI-native ticketing + error
tracking system — in every language but Ruby. (The Ruby client ships as the
[`dispatch-rails` gem](https://rubygems.org/gems/dispatch-rails), which lives in the
product repo and is the **reference producer** for the wire contract below.)

## Why this repo exists

The original client library was Rails-only. To let any web or app team adopt Dispatch we
need SDKs across ecosystems — starting with JavaScript/TypeScript and Python. Three or more
languages all have to speak **one identical HTTP/JSON wire contract**. That contract is the
product; everything else is idiomatic per language. So this repo is organized contract-first.

## Layout

```
contract/        ← THE SOURCE OF TRUTH. OpenAPI + JSON Schema + golden fixtures.
packages/        ← JavaScript/TypeScript SDKs (pnpm workspace, @dispatch/* on npm)
  core/            framework-agnostic core (config, event schema, sampling, transport types)
  node/            Node server SDK (manual capture, auto-capture, source context)
  express/         Express adapter            fastify/  Fastify adapter
  browser/         browser error tracker + feedback widget          (later phase)
  react/  vue/     thin UI wrappers           (later phase)
python/          ← Python SDK (dispatch-sdk on PyPI, framework extras)
conformance/     ← cross-language golden-fixture runner (the invariant gate)
```

The Ruby gem is **not** here — it already works inside the product repo. It participates in
the contract as the reference producer (it generates the golden fixtures) and as the
backend's co-located consumer test.

## The plan

This repo is being built out in phases. **Phase 0 (this commit) is the contract**: the
OpenAPI for the tickets endpoint, the JSON Schema for the Sentry-shaped error event (which
did not exist anywhere before), the golden fixtures every SDK must reproduce, and the
conformance harness. Server SDKs (Node + Python) come next; the browser widget last.

See [`contract/README.md`](contract/README.md) for the contract details and
[`CONTRIBUTING.md`](CONTRIBUTING.md) for how to add a language.

## Versioning

Independent semver per package, but a **shared major == wire-contract version**. Every SDK
that speaks contract v1 stays in `1.x`; a breaking wire change bumps the whole family to
`2.0`. The contract version is carried in the `X-Dispatch-Sdk` header
(`dispatch-node/1.2.0 (contract/1)`) so the backend can observe which contract a client speaks.
