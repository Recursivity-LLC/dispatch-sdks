import { EventEmitter } from "node:events";
import {
  Client,
  type DispatchEvent,
  type TicketPayload,
  type TicketResponse,
  type Transport,
} from "@dispatch/core";
import { describe, expect, it, vi } from "vitest";
import { installGlobalHandlers } from "../src/handlers";

class FakeTransport implements Transport {
  events: DispatchEvent[] = [];
  sendEvent(event: DispatchEvent): void {
    this.events.push(event);
  }
  async postTicket(_payload: TicketPayload): Promise<TicketResponse | null> {
    return null;
  }
  async flush(): Promise<boolean> {
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
  });

  it("captures unhandledRejection (handled:false)", () => {
    const { client, transport } = makeClient();
    const emitter = new EventEmitter();
    installGlobalHandlers(client, { target: emitter });
    emitter.emit("unhandledRejection", new Error("rej"));
    expect(transport.events).toHaveLength(1);
    expect(transport.events[0]!.exception.values[0]!.mechanism.handled).toBe(false);
  });

  it("uninstall removes the listeners", () => {
    const { client, transport } = makeClient();
    const emitter = new EventEmitter();
    const uninstall = installGlobalHandlers(client, { target: emitter });
    uninstall();
    emitter.emit("unhandledRejection", new Error("rej"));
    expect(transport.events).toHaveLength(0);
  });

  it("respects capture toggles", () => {
    const { client, transport } = makeClient();
    const emitter = new EventEmitter();
    installGlobalHandlers(client, { target: emitter, captureUnhandledRejections: false });
    emitter.emit("unhandledRejection", new Error("rej"));
    expect(transport.events).toHaveLength(0);
  });
});
