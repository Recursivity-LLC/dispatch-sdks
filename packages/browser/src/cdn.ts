// CDN / <script> drop-in entry. Exposes a global `Dispatch` and auto-initialises from a config
// source so a no-build page can add error tracking with two tags:
//
//   <script type="application/json" id="dispatch-config">
//     { "apiKey": "dsp_live_...", "endpoint": "https://acme.dispatchit.app/api/v1/store",
//       "environment": "production" }
//   </script>
//   <script src="https://cdn.dispatchit.app/dispatch.browser.global.js"></script>
//
// (Or set window.__dispatchConfig before loading the script.)

import { type BrowserOptions, captureException, getClient, init } from "./index";

interface DispatchGlobal {
  Dispatch?: Record<string, unknown>;
  __dispatchConfig?: BrowserOptions;
}

const root = (typeof window !== "undefined" ? window : globalThis) as unknown as DispatchGlobal &
  typeof globalThis;

root.Dispatch = Object.assign(root.Dispatch ?? {}, { init, captureException, getClient });

function readConfig(): BrowserOptions | undefined {
  try {
    if (typeof document !== "undefined") {
      const el = document.getElementById("dispatch-config");
      if (el && el.textContent) return JSON.parse(el.textContent) as BrowserOptions;
    }
  } catch {
    /* fall through to the global */
  }
  return root.__dispatchConfig;
}

if (!getClient()) {
  const config = readConfig();
  if (config && config.apiKey) init(config);
}
