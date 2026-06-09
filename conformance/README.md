# Conformance

The gate that enforces the one invariant: **every SDK speaks the identical wire contract.**

Three layers, cheapest first:

1. **Schema validation** (active now). Every golden fixture — and, in each SDK's tests, every
   freshly-produced payload — validates against `../contract/schema/*.json`. See
   `../contract/scripts/validate.mjs`.
2. **Golden-fixture producer tests** (per SDK). Each SDK builds an event from a *synthetic
   equivalent* of the canonical exceptions, runs it through `normalize.mjs` (or the language
   port of it), and asserts a match against the matching `../contract/fixtures/event.*.json`.
   Normalization blanks the volatile fields (`event_id`, `timestamp`, `server_name`, `abs_path`,
   source-line contents, breadcrumb timestamps) so the comparison pins names, nesting, ordering,
   `in_app`, `mechanism`, and the limits.
3. **Backend round-trip** (the real proof). POST each fixture to a running backend's
   `/api/v1/store` and `/api/v1/tickets` and assert acceptance. The gem + backend already share
   the product repo, so the authoritative version of this lives there as a request spec; this
   package can drive it against an ephemeral backend (or a Pact-style recorded contract) in CI.

`normalize.mjs` is the shared JS normalizer. Each non-JS SDK ships an equivalent kept in lockstep
with that field list.

> Status: Phase 0 ships layer 1 (schema validation) and the normalizer. Layers 2–3 fill in as
> the Node and Python SDKs land.
