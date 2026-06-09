import { type Breadcrumb, describeClickTarget } from "./breadcrumbs";

// What the handlers need from the client — kept as an interface so this module doesn't import
// BrowserClient (avoids a cycle and makes it trivially testable).
export interface HandlerHost {
  captureException(error: unknown, context: { mechanismType?: string; handled?: boolean }): void;
  addBreadcrumb(crumb: Breadcrumb): void;
  captureClicks: boolean;
  captureConsole: boolean;
}

// The slice of an EventTarget we use; window/document satisfy it, and tests pass a fake.
export interface EventTargetLike {
  addEventListener(type: string, listener: (event: unknown) => void, useCapture?: boolean): void;
  removeEventListener(type: string, listener: (event: unknown) => void, useCapture?: boolean): void;
}

export interface InstallTargets {
  win?: EventTargetLike;
  doc?: EventTargetLike;
  consoleObj?: { error: (...args: unknown[]) => void };
}

function now(): number {
  return Date.now() / 1000;
}

function readField(event: unknown, key: string): unknown {
  return event && typeof event === "object" ? (event as Record<string, unknown>)[key] : undefined;
}

// Install window error/unhandledrejection capture + click/console breadcrumbs. Returns an
// uninstall function. Mirrors error_tracker.js, but distinguishes the rejection mechanism.
export function installBrowserHandlers(host: HandlerHost, targets: InstallTargets = {}): () => void {
  const win =
    targets.win ?? ((globalThis as { window?: EventTargetLike }).window as EventTargetLike | undefined);
  const doc = targets.doc ?? ((globalThis as { document?: EventTargetLike }).document as EventTargetLike | undefined);
  const consoleObj = targets.consoleObj ?? console;
  const cleanups: Array<() => void> = [];

  if (win) {
    const onError = (event: unknown): void => {
      const error = readField(event, "error");
      const message = readField(event, "message");
      const subject = error ?? (message != null ? new Error(String(message)) : event);
      host.captureException(subject, { mechanismType: "onerror", handled: false });
    };
    win.addEventListener("error", onError);
    cleanups.push(() => win.removeEventListener("error", onError));

    const onRejection = (event: unknown): void => {
      const reason = readField(event, "reason") ?? event;
      host.captureException(reason, { mechanismType: "onunhandledrejection", handled: false });
    };
    win.addEventListener("unhandledrejection", onRejection);
    cleanups.push(() => win.removeEventListener("unhandledrejection", onRejection));
  }

  if (host.captureClicks && doc) {
    const onClick = (event: unknown): void => {
      const label = describeClickTarget(readField(event, "target"));
      if (label) host.addBreadcrumb({ timestamp: now(), category: "ui.click", level: "info", message: label });
    };
    doc.addEventListener("click", onClick, true);
    cleanups.push(() => doc.removeEventListener("click", onClick, true));
  }

  if (host.captureConsole) {
    const original = consoleObj.error;
    consoleObj.error = (...args: unknown[]): void => {
      try {
        host.addBreadcrumb({
          timestamp: now(),
          category: "console",
          level: "error",
          message: args.map((a) => String(a)).join(" ").slice(0, 500),
        });
      } finally {
        original.apply(consoleObj, args);
      }
    };
    cleanups.push(() => {
      consoleObj.error = original;
    });
  }

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
