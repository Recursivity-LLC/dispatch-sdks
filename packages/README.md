# packages/

JavaScript/TypeScript SDKs, published under the `@dispatch/*` npm scope. pnpm workspace.

Landing in **Phase 1+** (server-side first, per the approved plan):

| Package | npm | Phase | Purpose |
| --- | --- | --- | --- |
| `core/` | `@dispatch/core` | 1 | Framework-agnostic core: config, event schema/types, sampling, dedup, `before_send`, ticket payload builder. No DOM, no Node builtins. |
| `node/` | `@dispatch/node` | 2 | Node server SDK: `captureException`, V8 stack parser, `fs` source context, bounded flush-queue transport, `uncaughtException`/`unhandledRejection` hooks. |
| `express/` | `@dispatch/express` | 3 | Express error-handler + request-context middleware. |
| `fastify/` | `@dispatch/fastify` | 3 | Fastify `onError` plugin. |
| `browser/` | `@dispatch/browser` | 4 ✅ / 5 ✅ | Browser error tracker (`.`) + bug-report widget (`./widget`): real cross-browser stack parser, breadcrumbs, beacon transport, rebuilt widget DOM with screenshot capture. ESM/CJS + two IIFE `<script>` drop-ins. |
| `react/`, `vue/` | `@dispatch/react`, `@dispatch/vue` | later | Thin wrappers mounting `@dispatch/browser` + error boundaries. |

Each builds with tsup (ESM + CJS + `.d.ts`), tests with Vitest + MSW, typechecks under TS strict.
Core logic is ported from the gem's `lib/dispatch/rails/`; the wire shape is pinned by
`../contract`.
