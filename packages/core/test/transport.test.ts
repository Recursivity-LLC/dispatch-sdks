import { describe, expect, it, vi } from "vitest";
import { resolveConfig } from "../src/config";
import { FetchTransport, QUEUE_LIMIT, type FetchLike } from "../src/transport";
import type { DispatchEvent } from "../src/types";

const config = resolveConfig({ apiKey: "dsp_live_secret", environment: "production" });

function fakeEvent(id: string): DispatchEvent {
  return {
    event_id: id,
    timestamp: 1700000000,
    platform: "javascript",
    level: "error",
    environment: "production",
    exception: { values: [] },
  };
}

function okFetch(body: unknown = { id: 1, status: "inbox", url: "https://x/tickets/1" }): {
  impl: FetchLike;
  calls: { url: string; init: Parameters<FetchLike>[1] }[];
} {
  const calls: { url: string; init: Parameters<FetchLike>[1] }[] = [];
  const impl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => body };
  };
  return { impl, calls };
}

describe("FetchTransport", () => {
  it("delivers events to the error endpoint with auth + sdk headers", async () => {
    const { impl, calls } = okFetch();
    const t = new FetchTransport(config, impl);
    t.sendEvent(fakeEvent("e1"));
    expect(await t.flush()).toBe(true);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://dispatchit.app/api/v1/store");
    expect(calls[0]!.init.headers["Authorization"]).toBe("Bearer dsp_live_secret");
    expect(calls[0]!.init.headers["X-Dispatch-Sdk"]).toMatch(/^dispatch-js\/.+ \(contract\/1\)$/);
    expect(JSON.parse(calls[0]!.init.body).event_id).toBe("e1");
  });

  it("posts tickets to the tickets endpoint and returns the parsed response", async () => {
    const { impl, calls } = okFetch({ id: 42, status: "inbox", url: "https://x/tickets/42" });
    const t = new FetchTransport(config, impl);
    const res = await t.postTicket({ ticket: { description: "boom" } });
    expect(res).toEqual({ id: 42, status: "inbox", url: "https://x/tickets/42" });
    expect(calls[0]!.url).toBe("https://dispatchit.app/api/v1/tickets");
  });

  it("returns null when the ticket POST is not ok", async () => {
    const impl: FetchLike = async () => ({ ok: false, status: 422, json: async () => ({}) });
    const t = new FetchTransport(config, impl);
    expect(await t.postTicket({ ticket: { description: "x" } })).toBeNull();
  });

  it("never throws when fetch rejects", async () => {
    const impl: FetchLike = async () => {
      throw new Error("network down");
    };
    const t = new FetchTransport(config, impl);
    t.sendEvent(fakeEvent("e1"));
    expect(await t.flush()).toBe(true);
    expect(await t.postTicket({ ticket: { description: "x" } })).toBeNull();
  });

  it("bounds the queue at QUEUE_LIMIT, dropping the overflow", async () => {
    const { impl, calls } = okFetch();
    const t = new FetchTransport(config, impl);
    // Push synchronously: one event drains in-flight, QUEUE_LIMIT more queue, the rest drop.
    for (let i = 0; i < QUEUE_LIMIT + 50; i++) t.sendEvent(fakeEvent(`e${i}`));
    await t.flush();
    expect(calls.length).toBe(QUEUE_LIMIT + 1);
  });

  it("logs a drop warning only in debug mode", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const debugCfg = resolveConfig({ apiKey: "x", environment: "production", debug: true });
    const { impl } = okFetch();
    const t = new FetchTransport(debugCfg, impl);
    for (let i = 0; i < QUEUE_LIMIT + 5; i++) t.sendEvent(fakeEvent(`e${i}`));
    await t.flush();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
