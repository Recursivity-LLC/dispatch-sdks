import type {
  DispatchConfig,
} from "./config";
import type {
  DispatchEvent,
  DispatchExceptionValue,
  DispatchFrame,
  DispatchRequest,
  DispatchUser,
  Level,
  Tags,
} from "./types";
import { parseStack } from "./stacktrace";
import { epochSeconds, uuid32 } from "./util";

export const MAX_CAUSES = 5;
export const VALUE_MAX_LENGTH = 2000;

export interface BuildEventInput {
  config: DispatchConfig;
  handled: boolean;
  platform?: string;
  level?: Level;
  user?: DispatchUser | null;
  tags?: Tags;
  request?: DispatchRequest;
  transaction?: string | null;
  serverName?: string | null;
  /** Injectable for runtime-specific parsing (e.g. the Node V8 parser). Defaults to core's. */
  parseStack?: (stack?: string | null) => DispatchFrame[];
  /** Injectable for deterministic tests. */
  now?: () => number;
  uuid?: () => string;
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
  handled: boolean,
  parse: (stack?: string | null) => DispatchFrame[],
): DispatchExceptionValue {
  const err = asError(error);
  const type = (err && typeof err.name === "string" && err.name) || "Error";
  const rawMessage =
    err && typeof err.message === "string" ? err.message : String(error ?? "");
  const stack = err && typeof err.stack === "string" ? err.stack : undefined;
  return {
    type,
    value: rawMessage.slice(0, VALUE_MAX_LENGTH),
    mechanism: { type: "generic", handled },
    stacktrace: { frames: parse(stack) },
  };
}

// Walk the `cause` chain up to MAX_CAUSES and emit Sentry-ordered values: OLDEST CAUSE FIRST,
// the raised error LAST. Mirrors EventBuilder#exception_values.
function exceptionValues(
  error: unknown,
  handled: boolean,
  parse: (stack?: string | null) => DispatchFrame[],
): DispatchExceptionValue[] {
  const chain: unknown[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSES && current != null; depth++) {
    chain.push(current);
    current = asError(current)?.cause;
  }
  chain.reverse();
  return chain.map((e) => exceptionValue(e, handled, parse));
}

// Build the Sentry-shaped event from an error. The pure assembly lives here; runtime-specific
// concerns (source context, request extraction) are layered on by injecting parseStack and
// passing request/user/transaction.
export function buildEvent(error: unknown, input: BuildEventInput): DispatchEvent {
  const parse = input.parseStack ?? parseStack;
  const now = input.now ?? epochSeconds;
  const id = input.uuid ?? uuid32;
  const c = input.config;

  const derivedTags: Tags = {};
  if (input.transaction) derivedTags["transaction"] = input.transaction;
  const tags: Tags = { ...derivedTags, ...c.tags, ...(input.tags ?? {}) };

  const event: DispatchEvent = {
    event_id: id(),
    timestamp: now(),
    platform: input.platform ?? "javascript",
    level: input.level ?? "error",
    environment: c.environment,
    exception: { values: exceptionValues(error, input.handled, parse) },
  };

  // Optional fields are set only when present, so they're omitted (not null) on the wire.
  if (c.release != null) event.release = c.release;
  if (input.serverName != null) event.server_name = input.serverName;
  if (input.transaction != null) event.transaction = input.transaction;
  if (input.request) event.request = input.request;
  const user = input.user ?? c.user;
  if (user != null) event.user = user;
  if (Object.keys(tags).length > 0) event.tags = tags;
  event.sdk = c.sdk;

  return event;
}
