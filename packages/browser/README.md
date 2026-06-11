# @dispatchitapp/browser

The browser error tracker for [Dispatch](https://dispatchit.app). Captures uncaught errors and
unhandled promise rejections (Sentry-shaped, `platform: "javascript"`) with breadcrumbs and the
user path, and ships them via `fetch` keepalive — falling back to `navigator.sendBeacon` on
unload. This entry is the **error tracker only**; the feedback widget ships separately so you
can include error tracking without the modal DOM.

## ESM / bundler

```ts
import { init } from "@dispatchitapp/browser";

init({
  apiKey: "dsp_live_...",
  endpoint: "https://acme.dispatchit.app/api/v1/tickets", // errors go to the derived /store
  environment: "production",
  release: import.meta.env.VITE_GIT_SHA,
  // captureClicks: true (default), captureConsole: false (default)
});
```

## No-build `<script>` drop-in

```html
<script type="application/json" id="dispatch-config">
  { "apiKey": "dsp_live_...", "endpoint": "https://acme.dispatchit.app/api/v1/store",
    "environment": "production" }
</script>
<script src="https://cdn.dispatchit.app/dispatch.browser.global.js"></script>
```

The CDN bundle exposes `window.Dispatch` and auto-initialises from that config tag (or
`window.__dispatchConfig`). `window.Dispatch.captureException(err)` is available for manual capture.

## What it captures

- Uncaught errors (`mechanism.type: "onerror"`) and unhandled rejections
  (`mechanism.type: "onunhandledrejection"`) — `handled: false`.
- A real **cross-browser stack parser** (Chrome/V8, Firefox/Safari, async + anonymous frames,
  with column numbers) — a proper replacement for the gem's 3-regex `error_tracker.js`.
- **Breadcrumbs** (clicks + optional `console.error`) and the **user_path** (last few clicks).
- The page `url` + `User-Agent`, plus your configured `user`, `tags`, `release`, sampling and
  `beforeSend`.

Output validates against `../../contract/schema/event.schema.json` (`test/index.test.ts`).

## Feedback widget

A separate entry, `@dispatchitapp/browser/widget`, renders the floating 💬 button + modal where a
user reports a bug, requests a feature, or suggests a change (a framework-free rebuild of the
gem's widget). Import it independently so a page can ship the widget, the error tracker, or both:

```ts
import { initWidget } from "@dispatchitapp/browser/widget";

initWidget({
  apiKey: "dsp_live_...",
  endpoint: "https://acme.dispatchit.app/api/v1/tickets",
  user: () => currentUser && { email: currentUser.email, external_id: currentUser.id },
  severity: "high",            // default severity + metadata.severity_hint for this surface
  labels: ["checkout"],         // → metadata.labels
});
```

It captures screenshots (file picker, drag & drop, paste → base64; max 5, 5 MB each), the page
URL/user-agent/viewport/referrer, the click `user_path`, and optional `console_errors`, then
POSTs a `{ ticket }` (with `Idempotency-Key` + `X-Dispatch-Widget-Version`) — matching the
golden `ticket.widget.json`. There's also a `dispatch.widget.global.js` `<script>` drop-in that
auto-mounts from a `#dispatch-widget-config` tag.

## Scripts

```bash
pnpm test · pnpm typecheck · pnpm build   # build emits ESM + CJS + d.ts and a minified IIFE
```
