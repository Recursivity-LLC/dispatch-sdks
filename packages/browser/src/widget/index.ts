// @dispatch/browser/widget — the floating feedback widget.
//
// A separate entry from the error tracker so a page can include one without the other.
//
//   import { initWidget } from "@dispatch/browser/widget";
//   initWidget({
//     apiKey: "dsp_live_...",
//     endpoint: "https://acme.dispatchit.app/api/v1/tickets",
//     user: () => currentUser && { email: currentUser.email, external_id: currentUser.id },
//   });

import { Widget, type WidgetOptions } from "./Widget";

/** Construct and mount the widget. Returns it (call .unmount() to remove). */
export function initWidget(options: WidgetOptions): Widget {
  return new Widget(options).mount();
}

export { Widget } from "./Widget";
export type { WidgetOptions } from "./Widget";
export {
  buildWidgetTicket,
  WIDGET_VERSION,
  type BuildWidgetTicketInput,
  type WidgetScreenshot,
} from "./ticket";
export { buildWidgetDom, type WidgetRefs } from "./render";
export { type ButtonPosition } from "./styles";
