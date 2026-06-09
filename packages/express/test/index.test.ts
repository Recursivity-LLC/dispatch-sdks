import {
  Client,
  type DispatchEvent,
  type TicketPayload,
  type TicketResponse,
  type Transport,
} from "@dispatch/core";
import { describe, expect, it } from "vitest";
import { errorHandler, type ExpressRequestLike } from "../src/index";

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
  const client = new Client({
    apiKey: "x",
    environment: "production",
    platform: "node",
    transport,
  });
  return { client, transport };
}

function fakeReq(overrides: Partial<ExpressRequestLike> = {}): ExpressRequestLike {
  return {
    method: "POST",
    originalUrl: "/orders/42?ref=email",
    baseUrl: "",
    route: { path: "/orders/:id" },
    headers: {
      host: "shop.example.com",
      "user-agent": "UA/1.0",
      "x-request-id": "req-1",
      cookie: "secret=should-not-leak",
    },
    protocol: "https",
    ip: "203.0.113.7",
    ...overrides,
  };
}

describe("errorHandler", () => {
  it("captures unhandled errors with request context and re-propagates", () => {
    const { client, transport } = makeClient();
    const handler = errorHandler({ client });
    const err = new Error("boom");
    let forwarded: unknown = "unset";

    handler(err, fakeReq(), {}, (e?: unknown) => {
      forwarded = e;
    });

    expect(forwarded).toBe(err); // never swallowed
    expect(transport.events).toHaveLength(1);
    const event = transport.events[0]!;
    expect(event.exception.values[0]!.mechanism.handled).toBe(false);
    expect(event.transaction).toBe("POST /orders/:id");
    expect(event.request?.url).toBe("https://shop.example.com/orders/42");
    expect(event.request?.method).toBe("POST");
    expect(event.request?.query_string).toBe("ref=email");
    expect(event.request?.headers).toMatchObject({
      Host: "shop.example.com",
      "User-Agent": "UA/1.0",
      "X-Request-Id": "req-1",
    });
    // disallowed header is dropped
    expect(event.request?.headers).not.toHaveProperty("cookie");
    expect(event.request?.env).toEqual({ REMOTE_ADDR: "203.0.113.7" });
  });

  it("resolves the user via req.user and the user option", () => {
    const { client, transport } = makeClient();
    errorHandler({ client })(new Error("e"), fakeReq({ user: { id: 7, email: "a@b.co" } }), {}, () => {});
    expect(transport.events[0]!.user).toEqual({ id: "7", email: "a@b.co" });

    transport.events.length = 0;
    errorHandler({ client, user: () => ({ external_id: "u_99", email: "c@d.co" }) })(
      new Error("e"),
      fakeReq(),
      {},
      () => {},
    );
    expect(transport.events[0]!.user).toEqual({ id: "u_99", email: "c@d.co" });
  });

  it("honours shouldHandle but still forwards the error", () => {
    const { client, transport } = makeClient();
    let forwarded: unknown = "unset";
    errorHandler({ client, shouldHandle: () => false })(new Error("e"), fakeReq(), {}, (e) => {
      forwarded = e;
    });
    expect(transport.events).toHaveLength(0);
    expect(forwarded).toBeInstanceOf(Error);
  });

  it("does nothing harmful without a configured client", () => {
    let forwarded: unknown = "unset";
    expect(() =>
      errorHandler()(new Error("e"), fakeReq(), {}, (e) => {
        forwarded = e;
      }),
    ).not.toThrow();
    expect(forwarded).toBeInstanceOf(Error);
  });
});
