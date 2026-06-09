// CDN / <script> drop-in for the widget. Exposes window.Dispatch.initWidget and auto-mounts
// from a config tag, mirroring the gem's auto-rendered widget:
//
//   <script type="application/json" id="dispatch-widget-config">
//     { "apiKey": "dsp_live_...", "endpoint": "https://acme.dispatchit.app/api/v1/tickets" }
//   </script>
//   <script src="https://cdn.dispatchit.app/dispatch.widget.global.js"></script>

import { type WidgetOptions, initWidget } from "./index";

interface DispatchGlobal {
  Dispatch?: Record<string, unknown>;
  __dispatchWidgetConfig?: WidgetOptions;
}

const root = (typeof window !== "undefined" ? window : globalThis) as unknown as DispatchGlobal &
  typeof globalThis;

root.Dispatch = Object.assign(root.Dispatch ?? {}, { initWidget });

function readConfig(): WidgetOptions | undefined {
  try {
    if (typeof document !== "undefined") {
      const el = document.getElementById("dispatch-widget-config");
      if (el && el.textContent) return JSON.parse(el.textContent) as WidgetOptions;
    }
  } catch {
    /* fall through to the global */
  }
  return root.__dispatchWidgetConfig;
}

const config = readConfig();
if (config && config.apiKey) {
  const mount = (): void => {
    initWidget(config);
  };
  if (typeof document !== "undefined" && document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
}
