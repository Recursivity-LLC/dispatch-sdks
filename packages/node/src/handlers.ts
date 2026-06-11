import type { Client } from "@dispatchitapp/core";

type Listener = (...args: unknown[]) => void;

// The slice of `process` (or a test double) we need: register and remove listeners.
export interface ProcessLike {
  on(event: string, listener: Listener): unknown;
  removeListener(event: string, listener: Listener): unknown;
}

export interface GlobalHandlerOptions {
  /** Capture uncaught exceptions. Default true. */
  captureUncaughtException?: boolean;
  /** Capture unhandled promise rejections. Default true. */
  captureUnhandledRejections?: boolean;
  /** After capturing+flushing an uncaught exception, exit(1). Default true (Node would have
   *  crashed anyway — continuing leaves the process in an undefined state). */
  exitOnUncaught?: boolean;
  /** After capturing+flushing an unhandled rejection, exit(1). Default true: Node's own
   *  default (--unhandled-rejections=throw) crashes the process, and merely installing a
   *  listener would silently disable that. We report, then preserve the native outcome. */
  exitOnUnhandledRejection?: boolean;
  /** Drain the event queue when the event loop empties (the at_exit-flush analogue of the
   *  gem's shutdown_timeout drain). Default true. */
  flushOnBeforeExit?: boolean;
  /** Flush budget before exit, ms. Default: config.shutdownTimeout (3000). */
  flushTimeout?: number;
  /** Called after flush instead of exiting — for custom shutdown (and tests). When set, the
   *  fatal error is not printed to stderr; the callback owns the response. */
  onFatalError?: (err: unknown) => void;
  /** Event target. Defaults to the global process; injectable for tests. */
  target?: ProcessLike;
  /** Exit function. Defaults to process.exit; injectable for tests. */
  exit?: (code: number) => void;
}

// Wire the client into Node's global error events — the runtime-level analogue of the gem's
// Rack middleware + at_exit hook. The contract mirrors the gem's: capture, then preserve the
// runtime's native crash behavior (print the error, exit non-zero) — never swallow.
// Returns an uninstall function.
export function installGlobalHandlers(
  client: Client,
  options: GlobalHandlerOptions = {},
): () => void {
  const target = options.target ?? (process as unknown as ProcessLike);
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const flushTimeout = options.flushTimeout ?? client.config.shutdownTimeout;
  const installed: Array<[string, Listener]> = [];

  // Flush, then hand off to onFatalError or exit(1). Registering a listener suppresses
  // Node's native crash report, so we print the error first to keep the trace visible.
  const flushThenExit = (err: unknown) => {
    if (!options.onFatalError) console.error(err);
    void client.flush(flushTimeout).finally(() => {
      if (options.onFatalError) options.onFatalError(err);
      else exit(1);
    });
  };

  if (options.captureUncaughtException !== false) {
    const onUncaught: Listener = (err) => {
      client.captureException(err, { handled: false, tags: { source: "uncaughtException" } });
      if (options.exitOnUncaught !== false || options.onFatalError) flushThenExit(err);
    };
    target.on("uncaughtException", onUncaught);
    installed.push(["uncaughtException", onUncaught]);
  }

  if (options.captureUnhandledRejections !== false) {
    const onRejection: Listener = (reason) => {
      client.captureException(reason, { handled: false, tags: { source: "unhandledRejection" } });
      if (options.exitOnUnhandledRejection !== false || options.onFatalError) flushThenExit(reason);
    };
    target.on("unhandledRejection", onRejection);
    installed.push(["unhandledRejection", onRejection]);
  }

  if (options.flushOnBeforeExit !== false) {
    // A pending fetch keeps the loop alive, so this is mostly insurance for custom
    // transports — and the closest Node analogue of the gem's at_exit queue drain.
    const onBeforeExit: Listener = () => {
      void client.flush(flushTimeout);
    };
    target.on("beforeExit", onBeforeExit);
    installed.push(["beforeExit", onBeforeExit]);
  }

  return () => {
    for (const [event, listener] of installed) target.removeListener(event, listener);
  };
}
