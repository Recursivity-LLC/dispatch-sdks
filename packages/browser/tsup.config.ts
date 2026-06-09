import { defineConfig } from "tsup";

export default defineConfig([
  // Library build: ESM + CJS + types for the error tracker (.) and the widget (./widget).
  // @dispatch/core stays an external dependency.
  {
    entry: { index: "src/index.ts", widget: "src/widget/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "es2020",
    external: ["@dispatch/core"],
  },
  // CDN drop-ins: self-contained IIFEs that auto-install from a config tag. Bundle @dispatch/core
  // in (no external) so a <script> tag needs nothing else. One for the error tracker, one for the
  // widget — kept separate so a page can load only what it uses.
  {
    entry: { "dispatch.browser": "src/cdn.ts", "dispatch.widget": "src/widget/cdn.ts" },
    format: ["iife"],
    minify: true,
    sourcemap: true,
    target: "es2017",
    clean: false,
  },
]);
