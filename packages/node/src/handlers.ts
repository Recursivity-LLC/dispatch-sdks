import type { Client } from "@dispatch/core";

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
  /** Flush budget before exit, ms. Default 2000. */
  flushTimeout?: number;
  /** Called after flush instead of exiting — for custom shutdown (and tests). */
  onFatalError?: (err: unknown) => void;
  /** Event target. Defaults to the global process; injectable for tests. */
  target?: ProcessLike;
  /** Exit function. Defaults to process.exit; injectable for tests. */
  exit?: (code: number) => void;
}

// Wire the client into Node's global error events — the runtime-level analogue of the gem's
// Rack middleware + Rails.error subscriber. Returns an uninstall function.
export function installGlobalHandlers(
  client: Client,
  options: GlobalHandlerOptions = {},
): () => void {
  const target = options.target ?? (process as unknown as ProcessLike);
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const flushTimeout = options.flushTimeout ?? 2000;
  const installed: Array<[string, Listener]> = [];

  if (options.captureUncaughtException !== false) {
    const onUncaught: Listener = (err) => {
      client.captureException(err, { handled: false });
      void client.flush(flushTimeout).finally(() => {
        if (options.onFatalError) options.onFatalError(err);
        else if (options.exitOnUncaught !== false) exit(1);
      });
    };
    target.on("uncaughtException", onUncaught);
    installed.push(["uncaughtException", onUncaught]);
  }

  if (options.captureUnhandledRejections !== false) {
    const onRejection: Listener = (reason) => {
      client.captureException(reason, { handled: false });
    };
    target.on("unhandledRejection", onRejection);
    installed.push(["unhandledRejection", onRejection]);
  }

  return () => {
    for (const [event, listener] of installed) target.removeListener(event, listener);
  };
}
