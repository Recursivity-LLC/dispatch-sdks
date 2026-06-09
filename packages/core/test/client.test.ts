import { describe, expect, it } from "vitest";
import { Client } from "../src/client";
import type { Transport } from "../src/transport";
import type { DispatchEvent, TicketPayload, TicketResponse } from "../src/types";

class FakeTransport implements Transport {
  events: DispatchEvent[] = [];
  tickets: TicketPayload[] = [];
  ticketResponse: TicketResponse | null = { id: 1, status: "inbox", url: "https://x/1" };
  sendEvent(e: DispatchEvent): void {
    this.events.push(e);
  }
  async postTicket(p: TicketPayload): Promise<TicketResponse | null> {
    this.tickets.push(p);
    return this.ticketResponse;
  }
  async flush(): Promise<boolean> {
    return true;
  }
}

function makeClient(overrides: Record<string, unknown> = {}) {
  const transport = new FakeTransport();
  const client = new Client({
    apiKey: "dsp_live_x",
    environment: "production",
    transport,
    ...overrides,
  });
  return { client, transport };
}

describe("Client.captureException", () => {
  it("captures a handled exception by default", () => {
    const { client, transport } = makeClient();
    client.captureException(new Error("boom"));
    expect(transport.events).toHaveLength(1);
    expect(transport.events[0]!.exception.values[0]!.mechanism.handled).toBe(true);
  });

  it("marks unhandled when the adapter says so", () => {
    const { client, transport } = makeClient();
    client.captureException(new Error("boom"), { handled: false, transaction: "orders#update" });
    expect(transport.events[0]!.exception.values[0]!.mechanism.handled).toBe(false);
    expect(transport.events[0]!.transaction).toBe("orders#update");
  });

  it("deduplicates the same error instance", () => {
    const { client, transport } = makeClient();
    const err = new Error("boom");
    client.captureException(err);
    client.captureException(err);
    expect(transport.events).toHaveLength(1);
  });

  it("drops everything at sample rate 0", () => {
    const { client, transport } = makeClient({ errorSampleRate: 0 });
    client.captureException(new Error("boom"));
    expect(transport.events).toHaveLength(0);
  });

  it("respects beforeSend dropping (null) and mutation", () => {
    const dropped = makeClient({ beforeSend: () => null });
    dropped.client.captureException(new Error("boom"));
    expect(dropped.transport.events).toHaveLength(0);

    const mutated = makeClient({
      beforeSend: (e: DispatchEvent) => ({ ...e, environment: "scrubbed" }),
    });
    mutated.client.captureException(new Error("boom"));
    expect(mutated.transport.events[0]!.environment).toBe("scrubbed");
  });

  it("does not capture in a disabled environment", () => {
    const { client, transport } = makeClient({ environment: "development" });
    client.captureException(new Error("boom"));
    expect(transport.events).toHaveLength(0);
  });

  it("does not capture when captureExceptions is false", () => {
    const { client, transport } = makeClient({ captureExceptions: false });
    client.captureException(new Error("boom"));
    expect(transport.events).toHaveLength(0);
  });

  it("never throws, even on odd input", () => {
    const { client } = makeClient();
    expect(() => client.captureException(undefined)).not.toThrow();
    expect(() => client.captureException(42)).not.toThrow();
  });
});

describe("Client.report", () => {
  it("posts a ticket and returns the response", async () => {
    const { client, transport } = makeClient();
    const res = await client.report({ description: "Nightly import aborted", severity: "high" });
    expect(res).toEqual({ id: 1, status: "inbox", url: "https://x/1" });
    expect(transport.tickets[0]!.ticket.description).toBe("Nightly import aborted");
  });

  it("returns null and does not POST when unconfigured", async () => {
    const { client, transport } = makeClient({ apiKey: "" });
    expect(await client.report({ description: "x" })).toBeNull();
    expect(transport.tickets).toHaveLength(0);
  });
});
