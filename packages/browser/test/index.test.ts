// @vitest-environment node
// (no DOM needed here; node env keeps import.meta.url a real file:// URL for schema loading)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { DispatchEvent, TicketPayload, TicketResponse, Transport } from "@dispatch/core";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { afterEach, describe, expect, it } from "vitest";
import { close, getClient, init } from "../src/index";

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

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const eventSchema = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../../contract/schema/event.schema.json", import.meta.url)),
    "utf8",
  ),
);
const validateEvent = ajv.compile(eventSchema);

const baseOptions = {
  apiKey: "x",
  environment: "production",
  endpoint: "https://acme.dispatchit.app/api/v1/tickets",
  autoInstall: false as const,
};

afterEach(() => close());

describe("init (browser)", () => {
  it("captures via the default client and conforms to the contract", () => {
    const transport = new FakeTransport();
    init({ ...baseOptions, transport });
    getClient()!.captureException(new Error("manual"));

    const event = transport.events[0]!;
    expect(event.platform).toBe("javascript");
    expect(event.sdk?.name).toBe("dispatch-browser");
    expect(event.exception.values[0]!.mechanism).toEqual({ type: "generic", handled: true });

    const ok = validateEvent(event);
    if (!ok) console.error(validateEvent.errors);
    expect(ok).toBe(true);
  });

  it("produces schema-valid onerror and onunhandledrejection events", () => {
    const transport = new FakeTransport();
    const client = init({ ...baseOptions, transport });

    const err = new Error("boom");
    err.stack = "Error: boom\n    at f (https://shop.example.com/a.js:1:2)";
    client.captureException(err, { mechanismType: "onerror", handled: false });
    client.captureException("oops", { mechanismType: "onunhandledrejection", handled: false });

    expect(transport.events.every((e) => validateEvent(e) === true)).toBe(true);
    expect(transport.events[1]!.exception.values[0]!.mechanism.type).toBe("onunhandledrejection");
  });
});
