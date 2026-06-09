import type {
  DispatchConfig,
  DispatchEvent,
  DispatchExceptionValue,
  DispatchRequest,
  DispatchUser,
  Level,
  Tags,
} from "@dispatch/core";
import type { Breadcrumb } from "./breadcrumbs";
import { parseStack } from "./stack";

export const MAX_CAUSES = 5;
export const VALUE_MAX_LENGTH = 2000;

// The browser event extends the wire event with the two browser-only fields the contract
// permits: breadcrumbs and the user_path.
export interface BrowserEvent extends DispatchEvent {
  breadcrumbs?: { values: Breadcrumb[] };
  user_path?: string[];
}

export interface BuildBrowserEventOptions {
  config: DispatchConfig;
  /** "onerror" | "onunhandledrejection" (auto-capture) | "generic" (manual). */
  mechanismType: string;
  handled: boolean;
  level?: Level;
  breadcrumbs?: Breadcrumb[];
  userPath?: string[];
  user?: DispatchUser | null;
  tags?: Tags;
  now?: () => number;
  uuid?: () => string;
  url?: string;
  userAgent?: string;
}

function uuid32(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "");
}

interface ErrorLike {
  name?: unknown;
  message?: unknown;
  stack?: unknown;
  cause?: unknown;
}

function asError(value: unknown): ErrorLike | null {
  return typeof value === "object" && value !== null ? (value as ErrorLike) : null;
}

function exceptionValue(
  error: unknown,
  mechanismType: string,
  handled: boolean,
): DispatchExceptionValue {
  const err = asError(error);
  const type = (err && typeof err.name === "string" && err.name) || "Error";
  const message = err && typeof err.message === "string" ? err.message : String(error ?? "");
  const stack = err && typeof err.stack === "string" ? err.stack : undefined;
  return {
    type,
    value: message.slice(0, VALUE_MAX_LENGTH),
    mechanism: { type: mechanismType, handled },
    stacktrace: { frames: parseStack(stack) },
  };
}

function exceptionValues(
  error: unknown,
  mechanismType: string,
  handled: boolean,
): DispatchExceptionValue[] {
  const chain: unknown[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSES && current != null; depth++) {
    chain.push(current);
    current = asError(current)?.cause;
  }
  chain.reverse();
  return chain.map((e) => exceptionValue(e, mechanismType, handled));
}

// Build a browser (platform "javascript") event: the exception (+ cause chain), breadcrumbs,
// user_path, and the page request (url + User-Agent). Mirrors error_tracker.js's buildEvent,
// but with a real stack parser and proper onunhandledrejection mechanism.
export function buildBrowserEvent(error: unknown, opts: BuildBrowserEventOptions): BrowserEvent {
  const now = opts.now ?? (() => Date.now() / 1000);
  const id = opts.uuid ?? uuid32;
  const c = opts.config;
  const url = opts.url ?? globalThis.location?.href;
  const userAgent = opts.userAgent ?? globalThis.navigator?.userAgent;

  const event: BrowserEvent = {
    event_id: id(),
    timestamp: now(),
    platform: "javascript",
    level: opts.level ?? "error",
    environment: c.environment,
    exception: { values: exceptionValues(error, opts.mechanismType, opts.handled) },
  };

  if (c.release != null) event.release = c.release;
  if (opts.breadcrumbs && opts.breadcrumbs.length > 0) {
    event.breadcrumbs = { values: opts.breadcrumbs };
  }
  if (opts.userPath && opts.userPath.length > 0) event.user_path = opts.userPath;

  const request: DispatchRequest = {};
  if (url) request.url = url;
  if (userAgent) request.headers = { "User-Agent": userAgent };
  if (request.url || request.headers) event.request = request;

  const user = opts.user ?? c.user;
  if (user != null) event.user = user;

  const tags = { ...c.tags, ...(opts.tags ?? {}) };
  if (Object.keys(tags).length > 0) event.tags = tags;

  event.sdk = c.sdk;
  return event;
}
