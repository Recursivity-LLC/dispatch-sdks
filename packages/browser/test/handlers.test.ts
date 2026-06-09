import { describe, expect, it, vi } from "vitest";
import { type EventTargetLike, type HandlerHost, installBrowserHandlers } from "../src/handlers";

function fakeTarget() {
  const listeners: Record<string, (event: unknown) => void> = {};
  const target: EventTargetLike = {
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    removeEventListener(type) {
      delete listeners[type];
    },
  };
  return { target, listeners };
}

interface RecordingHost extends HandlerHost {
  events: Array<{ error: unknown; context: { mechanismType?: string; handled?: boolean } }>;
  crumbs: Array<{ category: string; message: string }>;
}

function recordingHost(overrides: Partial<HandlerHost> = {}): RecordingHost {
  const events: RecordingHost["events"] = [];
  const crumbs: RecordingHost["crumbs"] = [];
  return {
    events,
    crumbs,
    captureClicks: true,
    captureConsole: false,
    captureException: (error, context) => events.push({ error, context }),
    addBreadcrumb: (crumb) => crumbs.push(crumb),
    ...overrides,
  };
}

describe("installBrowserHandlers", () => {
  it("captures window error as onerror (handled:false)", () => {
    const host = recordingHost();
    const win = fakeTarget();
    installBrowserHandlers(host, { win: win.target });
    const err = new Error("boom");
    win.listeners["error"]!({ error: err, message: "boom" });
    expect(host.events).toHaveLength(1);
    expect(host.events[0]!.context).toEqual({ mechanismType: "onerror", handled: false });
    expect(host.events[0]!.error).toBe(err);
  });

  it("captures unhandledrejection as onunhandledrejection", () => {
    const host = recordingHost();
    const win = fakeTarget();
    installBrowserHandlers(host, { win: win.target });
    const reason = new Error("rej");
    win.listeners["unhandledrejection"]!({ reason });
    expect(host.events[0]!.context.mechanismType).toBe("onunhandledrejection");
    expect(host.events[0]!.error).toBe(reason);
  });

  it("records click breadcrumbs", () => {
    const host = recordingHost();
    const win = fakeTarget();
    const doc = fakeTarget();
    installBrowserHandlers(host, { win: win.target, doc: doc.target });
    const btn = document.createElement("button");
    btn.textContent = "Save";
    doc.listeners["click"]!({ target: btn });
    expect(host.crumbs[0]).toMatchObject({ category: "ui.click", message: 'button "Save"' });
  });

  it("wraps console.error when captureConsole, and restores on uninstall", () => {
    const host = recordingHost({ captureConsole: true });
    const win = fakeTarget();
    const original = vi.fn();
    const consoleObj = { error: original };
    const uninstall = installBrowserHandlers(host, { win: win.target, consoleObj });

    consoleObj.error("oops", 42);
    expect(host.crumbs[0]).toMatchObject({ category: "console", message: "oops 42" });
    expect(original).toHaveBeenCalledWith("oops", 42);

    uninstall();
    expect(consoleObj.error).toBe(original);
  });

  it("uninstall removes the window listeners", () => {
    const host = recordingHost();
    const win = fakeTarget();
    const uninstall = installBrowserHandlers(host, { win: win.target });
    uninstall();
    expect(win.listeners["error"]).toBeUndefined();
    expect(win.listeners["unhandledrejection"]).toBeUndefined();
  });
});
