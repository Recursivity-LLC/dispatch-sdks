import { EventEmitter } from "node:events";
import {
  Client,
  type DispatchEvent,
  type TicketPayload,
  type TicketResponse,
  type Transport,
} from "@dispatch/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installGlobalHandlers } from "../src/handlers";

class FakeTransport implements Transport {
  events: DispatchEvent[] = [];
  flushCalls: Array<number | undefined> = [];
  sendEvent(event: DispatchEvent): void {
    this.events.push(event);
  }
  async postTicket(_payload: TicketPayload): Promise<TicketResponse | null> {
    return null;
  }
  async flush(timeoutMs?: number): Promise<boolean> {
    this.flushCalls.push(timeoutMs);
    return true;
  }
}

function makeClient() {
  const transport = new FakeTransport();
  const client = new Client({
    apiKey: "x",
    environment: "production",
    platform: "node",
    transport,
  });
  return { client, transport };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("installGlobalHandlers", () => {
  it("captures uncaughtException (handled:false) then runs onFatalError", async () => {
    const { client, transport } = makeClient();
    const emitter = new EventEmitter();
    let fatal: unknown = "unset";
    installGlobalHandlers(client, { target: emitter, onFatalError: (e) => { fatal = e; } });

    const err = new Error("boom");
    emitter.emit("uncaughtException", err);

    await vi.waitFor(() => expect(fatal).toBe(err));
    expect(transport.events).toHaveLength(1);
    expect(transport.events[0]!.exception.values[0]!.mechanism.handled).toBe(false);
    expect(transport.events[0]!.tags!.source).toBe("uncaughtException");
  });

  it("prints the error and exits 1 on uncaughtException by default", async () => {
    const { client } = makeClient();
    const emitter = new EventEmitter();
    const exit = vi.fn();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    installGlobalHandlers(client, { target: emitter, exit });

    const err = new Error("boom");
    emitter.emit("uncaughtException", err);

    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
    expect(error).toHaveBeenCalledWith(err);
  });

  it("captures unhandledRejection (handled:false) and is fatal by default, like Node", async () => {
    const { client, transport } = makeClient();
    const emitter = new EventEmitter();
    const exit = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    installGlobalHandlers(client, { target: emitter, exit });

    emitter.emit("unhandledRejection", new Error("rej"));

    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
    expect(transport.events).toHaveLength(1);
    expect(transport.events[0]!.exception.values[0]!.mechanism.handled).toBe(false);
    expect(transport.events[0]!.tags!.source).toBe("unhandledRejection");
    expect(transport.flushCalls.length).toBeGreaterThan(0);
  });

  it("only captures the rejection when exitOnUnhandledRejection is false", async () => {
    const { client, transport } = makeClient();
    const emitter = new EventEmitter();
    const exit = vi.fn();
    installGlobalHandlers(client, { target: emitter, exit, exitOnUnhandledRejection: false });

    emitter.emit("unhandledRejection", new Error("rej"));

    expect(transport.events).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 10));
    expect(exit).not.toHaveBeenCalled();
  });

  it("flushes with the config shutdownTimeout on beforeExit", () => {
    const { client, transport } = makeClient();
    const emitter = new EventEmitter();
    installGlobalHandlers(client, { target: emitter });

    emitter.emit("beforeExit", 0);

    expect(transport.flushCalls).toEqual([3000]);
  });

  it("skips the beforeExit flush when flushOnBeforeExit is false", () => {
    const { client, transport } = makeClient();
    const emitter = new EventEmitter();
    installGlobalHandlers(client, { target: emitter, flushOnBeforeExit: false });

    emitter.emit("beforeExit", 0);

    expect(transport.flushCalls).toHaveLength(0);
  });

  it("uninstall removes the listeners", () => {
    const { client, transport } = makeClient();
    const emitter = new EventEmitter();
    const uninstall = installGlobalHandlers(client, { target: emitter, exit: vi.fn() });
    uninstall();
    emitter.emit("unhandledRejection", new Error("rej"));
    emitter.emit("beforeExit", 0);
    expect(transport.events).toHaveLength(0);
    expect(transport.flushCalls).toHaveLength(0);
  });

  it("respects capture toggles", () => {
    const { client, transport } = makeClient();
    const emitter = new EventEmitter();
    installGlobalHandlers(client, { target: emitter, captureUnhandledRejections: false });
    emitter.emit("unhandledRejection", new Error("rej"));
    expect(transport.events).toHaveLength(0);
  });
});
