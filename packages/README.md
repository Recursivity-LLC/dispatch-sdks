# packages/

JavaScript/TypeScript SDKs, published under the `@dispatchitapp/*` npm scope. pnpm workspace.

Landing in **Phase 1+** (server-side first, per the approved plan):

| Package | npm | Phase | Purpose |
| --- | --- | --- | --- |
| `core/` | `@dispatchitapp/core` | 1 | Framework-agnostic core: config, event schema/types, sampling, dedup, `before_send`, ticket payload builder. No DOM, no Node builtins. |
| `node/` | `@dispatchitapp/node` | 2 | Node server SDK: `captureException`, V8 stack parser, `fs` source context, bounded flush-queue transport, `uncaughtException`/`unhandledRejection` hooks. |
| `express/` | `@dispatchitapp/express` | 3 | Express error-handler + request-context middleware. |
| `fastify/` | `@dispatchitapp/fastify` | 3 | Fastify `onError` plugin. |
| `browser/` | `@dispatchitapp/browser` | 4 ✅ / 5 ✅ | Browser error tracker (`.`) + feedback widget (`./widget`): real cross-browser stack parser, breadcrumbs, beacon transport, rebuilt widget DOM with screenshot capture. ESM/CJS + two IIFE `<script>` drop-ins. |
| `react/`, `vue/` | `@dispatchitapp/react`, `@dispatchitapp/vue` | later | Thin wrappers mounting `@dispatchitapp/browser` + error boundaries. |

Each builds with tsup (ESM + CJS + `.d.ts`), tests with Vitest + MSW, typechecks under TS strict.
Core logic is ported from the gem's `lib/dispatch/rails/`; the wire shape is pinned by
`../contract`.
