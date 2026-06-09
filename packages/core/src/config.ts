import type { DispatchEvent, DispatchUser, Tags } from "./types";
import { SDK_NAME, SDK_VERSION } from "./version";

export const DEFAULT_ENDPOINT = "https://dispatchit.app/api/v1/tickets";
export const DEFAULT_ENABLED_ENVIRONMENTS = ["production", "staging"];

export interface DispatchOptions {
  /** Project API token (prefix dsp_live_). Required. */
  apiKey: string;
  /** Tickets endpoint. Default https://dispatchit.app/api/v1/tickets. */
  endpoint?: string;
  /** Error-ingest endpoint. Default: `endpoint` with the last path segment swapped to /store. */
  errorEndpoint?: string;
  /** Deploy environment. Default process.env.NODE_ENV, else "production". */
  environment?: string;
  /** Release identifier, e.g. a git SHA. */
  release?: string | null;
  /** Environments in which capture is active. Default ["production", "staging"]; [] means all. */
  enabledEnvironments?: string[];
  /** Master switch for exception capture. Default true. */
  captureExceptions?: boolean;
  /** Fraction of errors to report, 0..1. Default 1.0. */
  errorSampleRate?: number;
  /** Last chance to mutate or drop an event. Return null to drop. */
  beforeSend?: ((event: DispatchEvent) => DispatchEvent | null) | null;
  /** Static affected-user (server adapters resolve a per-request user instead). */
  user?: DispatchUser | null;
  /** Static tags attached to every event. */
  tags?: Tags;
  /** Identifies the producing SDK. Server adapters override the name (e.g. "dispatch-node"). */
  sdk?: { name: string; version: string };
  /** Log internal failures to console. Default false. */
  debug?: boolean;
  /** Base URL for human-facing report links. Default: the origin of `endpoint`. */
  reportBaseUrl?: string | null;
}

export interface DispatchConfig {
  apiKey: string;
  endpoint: string;
  errorEndpoint: string;
  reportBaseUrl: string | null;
  environment: string;
  release: string | null;
  enabledEnvironments: string[];
  captureExceptions: boolean;
  errorSampleRate: number;
  beforeSend: ((event: DispatchEvent) => DispatchEvent | null) | null;
  user: DispatchUser | null;
  tags: Tags;
  sdk: { name: string; version: string };
  debug: boolean;
}

// Default error endpoint: same host, last path segment swapped to /store
// ("/api/v1/tickets" -> "/api/v1/store"). Mirrors Configuration#effective_error_endpoint.
export function deriveErrorEndpoint(endpoint: string): string {
  return endpoint.replace(/\/[^/]+$/, "/store");
}

// Origin (scheme + host[:port]) of the endpoint, or null if unparseable.
// Mirrors Configuration#effective_report_base_url.
export function deriveReportBaseUrl(endpoint: string): string | null {
  try {
    return new URL(endpoint).origin;
  } catch {
    return null;
  }
}

function defaultEnvironment(): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env?.NODE_ENV;
  return env && env.length > 0 ? env : "production";
}

export function resolveConfig(options: DispatchOptions): DispatchConfig {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  return {
    apiKey: options.apiKey,
    endpoint,
    errorEndpoint: options.errorEndpoint ?? deriveErrorEndpoint(endpoint),
    reportBaseUrl: options.reportBaseUrl ?? deriveReportBaseUrl(endpoint),
    environment: options.environment ?? defaultEnvironment(),
    release: options.release ?? null,
    enabledEnvironments: options.enabledEnvironments ?? DEFAULT_ENABLED_ENVIRONMENTS,
    captureExceptions: options.captureExceptions ?? true,
    errorSampleRate: options.errorSampleRate ?? 1.0,
    beforeSend: options.beforeSend ?? null,
    user: options.user ?? null,
    tags: options.tags ?? {},
    sdk: options.sdk ?? { name: SDK_NAME, version: SDK_VERSION },
    debug: options.debug ?? false,
  };
}

export function configured(c: DispatchConfig): boolean {
  return Boolean(c.apiKey) && Boolean(c.endpoint);
}

export function environmentEnabled(c: DispatchConfig): boolean {
  return c.enabledEnvironments.length === 0 || c.enabledEnvironments.includes(c.environment);
}

export function errorTrackingEnabled(c: DispatchConfig): boolean {
  return configured(c) && c.captureExceptions;
}
