// @dispatchitapp/core — the framework-agnostic core of the Dispatch SDKs.
//
// On its own this is a usable minimal SDK (manual capture + report()) anywhere a global
// `fetch` exists (Node 18+, browsers). Runtime packages layer on top: @dispatchitapp/node adds
// source context, global handlers and flush-on-exit; @dispatchitapp/browser adds the error tracker
// and the feedback widget; framework adapters add middleware.

import { Client, type ClientOptions, type CaptureContext } from "./client";
import type { ReportInput } from "./ticket";
import type { TicketResponse } from "./types";

export { Client } from "./client";
export type { CaptureContext, ClientOptions } from "./client";
export {
  type DispatchOptions,
  type DispatchConfig,
  DEFAULT_ENDPOINT,
  DEFAULT_ENABLED_ENVIRONMENTS,
  deriveErrorEndpoint,
  deriveReportBaseUrl,
  resolveConfig,
  configured,
  environmentEnabled,
  errorTrackingEnabled,
} from "./config";
export { buildEvent, MAX_CAUSES, VALUE_MAX_LENGTH } from "./event";
export { parseStack, MAX_FRAMES } from "./stacktrace";
export { sampledOut } from "./sampling";
export { alreadyCaptured, markCaptured } from "./dedup";
export { buildTicketPayload, type ReportInput } from "./ticket";
export {
  FetchTransport,
  type Transport,
  type FetchLike,
  sdkHeader,
  QUEUE_LIMIT,
} from "./transport";
export { SDK_NAME, SDK_VERSION, CONTRACT_VERSION } from "./version";
export * from "./types";

// ---- Module-level default client (Sentry-style ergonomics) -------------------------------

let defaultClient: Client | null = null;

/** Initialise the default client. Call once at startup. Returns it for direct use. */
export function init(options: ClientOptions): Client {
  defaultClient = new Client(options);
  return defaultClient;
}

/** The default client, or null if init() hasn't been called. */
export function getClient(): Client | null {
  return defaultClient;
}

/** Report a handled (or, from adapters, unhandled) exception via the default client. */
export function captureException(error: unknown, context?: CaptureContext): void {
  defaultClient?.captureException(error, context);
}

/** File a curated ticket via the default client. Resolves null if uninitialised. */
export function report(input: ReportInput): Promise<TicketResponse | null> {
  return defaultClient ? defaultClient.report(input) : Promise.resolve(null);
}

/** Wait for queued events to flush. Resolves true if the queue drained in time. */
export function flush(timeoutMs?: number): Promise<boolean> {
  return defaultClient ? defaultClient.flush(timeoutMs) : Promise.resolve(true);
}

/** Flush and stop using the default client. */
export function close(timeoutMs?: number): Promise<boolean> {
  return defaultClient ? defaultClient.close(timeoutMs) : Promise.resolve(true);
}
