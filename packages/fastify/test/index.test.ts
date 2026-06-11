import {
  Client,
  type DispatchEvent,
  type TicketPayload,
  type TicketResponse,
  type Transport,
} from "@dispatchitapp/core";
import { describe, expect, it } from "vitest";
import {
  type FastifyRequestLike,
  type OnErrorHook,
  dispatchFastify,
  onErrorHook,
} from "../src/index";

class FakeTransport implements Transport {
  events: DispatchEvent[] = [];
  sendEvent(event: DispatchEvent): void {
    this.events.push(event);
  }
  async postTicket(_p: TicketPayload): Promise<TicketResponse | null> {
    return null;
  }
  async flush(): Promise<boolean> {
    return true;
  }
}

function makeClient() {
  const transport = new FakeTransport();
  const client = new Client({ apiKey: "x", environment: "production", platform: "node", transport });
  return { client, transport };
}

function fakeReq(overrides: Partial<FastifyRequestLike> = {}): FastifyRequestLike {
  return {
    method: "POST",
    url: "/orders/42?ref=email",
    routeOptions: { url: "/orders/:id" },
    headers: { host: "shop.example.com", "user-agent": "UA/1.0" },
    protocol: "https",
    ip: "203.0.113.7",
    ...overrides,
  };
}

describe("onErrorHook", () => {
  it("captures with route context (handled:false)", async () => {
    const { client, transport } = makeClient();
    await onErrorHook({ client })(fakeReq(), {}, new Error("boom"));

    expect(transport.events).toHaveLength(1);
    const event = transport.events[0]!;
    expect(event.exception.values[0]!.mechanism.handled).toBe(false);
    expect(event.transaction).toBe("POST /orders/:id");
    expect(event.request?.url).toBe("https://shop.example.com/orders/42");
    expect(event.request?.query_string).toBe("ref=email");
    expect(event.request?.env).toEqual({ REMOTE_ADDR: "203.0.113.7" });
  });

  it("resolves the user via the option", async () => {
    const { client, transport } = makeClient();
    await onErrorHook({ client, user: () => ({ external_id: "u_99", email: "c@d.co" }) })(
      fakeReq(),
      {},
      new Error("e"),
    );
    expect(transport.events[0]!.user).toEqual({ id: "u_99", email: "c@d.co" });
  });

  it("respects shouldHandle", async () => {
    const { client, transport } = makeClient();
    await onErrorHook({ client, shouldHandle: () => false })(fakeReq(), {}, new Error("e"));
    expect(transport.events).toHaveLength(0);
  });
});

describe("dispatchFastify plugin", () => {
  it("registers the onError hook and calls done; skips encapsulation", () => {
    const { client, transport } = makeClient();
    const hooks: Record<string, OnErrorHook> = {};
    const fakeFastify = {
      addHook(name: "onError", hook: OnErrorHook) {
        hooks[name] = hook;
      },
    };
    let doneCalled = false;
    dispatchFastify(fakeFastify, { client }, () => {
      doneCalled = true;
    });

    expect(doneCalled).toBe(true);
    expect(typeof hooks["onError"]).toBe("function");
    expect(
      (dispatchFastify as unknown as Record<symbol, unknown>)[Symbol.for("skip-override")],
    ).toBe(true);

    return hooks["onError"]!(fakeReq(), {}, new Error("boom")).then(() => {
      expect(transport.events).toHaveLength(1);
    });
  });
});
