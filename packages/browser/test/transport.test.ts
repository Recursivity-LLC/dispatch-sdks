import { resolveConfig } from "@dispatch/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserTransport } from "../src/transport";
import type { DispatchEvent } from "@dispatch/core";

const config = resolveConfig({
  apiKey: "dsp_live_secret",
  environment: "production",
  endpoint: "https://acme.dispatchit.app/api/v1/tickets",
});

function fakeEvent(): DispatchEvent {
  return {
    event_id: "e1",
    timestamp: 1,
    platform: "javascript",
    level: "error",
    environment: "production",
    exception: { values: [] },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BrowserTransport", () => {
  it("sends events via fetch keepalive with auth + sdk headers", () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetchMock);

    new BrowserTransport(config).sendEvent(fakeEvent());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as unknown as [string, Record<string, any>];
    expect(url).toBe("https://acme.dispatchit.app/api/v1/store");
    expect(init.keepalive).toBe(true);
    expect(init.headers.Authorization).toBe("Bearer dsp_live_secret");
    expect(init.headers["X-Dispatch-Sdk"]).toContain("(contract/1)");
  });

  it("falls back to sendBeacon with ?sentry_key= when fetch is unavailable", () => {
    vi.stubGlobal("fetch", undefined);
    const beacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { sendBeacon: beacon });

    new BrowserTransport(config).sendEvent(fakeEvent());

    expect(beacon).toHaveBeenCalledTimes(1);
    const [url] = beacon.mock.calls[0]! as unknown as [string, unknown];
    expect(url).toBe("https://acme.dispatchit.app/api/v1/store?sentry_key=dsp_live_secret");
  });

  it("postTicket returns parsed JSON on 2xx", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, status: 201, json: async () => ({ id: 1, status: "inbox", url: "u" }) }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await new BrowserTransport(config).postTicket({ ticket: { description: "x" } });
    expect(res).toEqual({ id: 1, status: "inbox", url: "u" });
    const [url] = fetchMock.mock.calls[0]! as unknown as [string, unknown];
    expect(url).toBe("https://acme.dispatchit.app/api/v1/tickets");
  });
});
