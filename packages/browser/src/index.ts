// @dispatch/browser — the browser error tracker.
//
// Captures uncaught errors + unhandled promise rejections (Sentry-shaped, platform
// "javascript"), with breadcrumbs and the user_path, and ships them via fetch-keepalive /
// sendBeacon. This entry is the error tracker only — the bug-report widget ships separately so
// you can include error tracking without the modal DOM.

import {
  type BrowserCaptureContext,
  BrowserClient,
  type BrowserOptions,
} from "./client";
import type { Breadcrumb } from "./breadcrumbs";

let defaultClient: BrowserClient | null = null;

/** Initialise the browser error tracker. Installs window handlers unless autoInstall:false. */
export function init(options: BrowserOptions): BrowserClient {
  const client = new BrowserClient(options);
  defaultClient = client;
  if (options.autoInstall !== false) client.installHandlers();
  return client;
}

export function getClient(): BrowserClient | null {
  return defaultClient;
}

/** Manually capture an error (handled by default). */
export function captureException(error: unknown, context?: BrowserCaptureContext): void {
  defaultClient?.captureException(error, context);
}

export function addBreadcrumb(crumb: Breadcrumb): void {
  defaultClient?.addBreadcrumb(crumb);
}

/** Remove the installed window handlers (and restore console.error). */
export function close(): void {
  defaultClient?.removeHandlers();
}

export { BrowserClient } from "./client";
export type { BrowserOptions, BrowserCaptureContext } from "./client";
export { parseStack, MAX_FRAMES } from "./stack";
export {
  BreadcrumbBuffer,
  describeClickTarget,
  type Breadcrumb,
  MAX_BREADCRUMBS,
  USER_PATH_LIMIT,
} from "./breadcrumbs";
export { buildBrowserEvent, type BrowserEvent } from "./event";
export { BrowserTransport } from "./transport";
export { installBrowserHandlers, type HandlerHost, type InstallTargets } from "./handlers";
export { SDK_NAME, SDK_VERSION } from "./version";
export type { DispatchEvent, DispatchOptions, DispatchUser, Level, Tags, Transport } from "@dispatch/core";
