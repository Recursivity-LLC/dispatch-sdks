import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  Client,
  type DispatchEvent,
  type TicketPayload,
  type TicketResponse,
  type Transport,
} from "@dispatch/core";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { getClient, init } from "../src/index";

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

describe("init (node)", () => {
  it("builds node-platform events with the dispatch-node sdk and source context", () => {
    const transport = new FakeTransport();
    init({ apiKey: "x", environment: "production", installGlobalHandlers: false, transport });
    const client = getClient() as Client;

    function boom(): void {
      throw new Error("kapow"); // the failing line in this test file
    }
    try {
      boom();
    } catch (err) {
      client.captureException(err);
    }

    const event = transport.events[0]!;
    expect(event.platform).toBe("node");
    expect(event.sdk?.name).toBe("dispatch-node");

    const frames = event.exception.values[0]!.stacktrace.frames;
    const appFrames = frames.filter((f) => f.in_app);
    expect(appFrames.length).toBeGreaterThan(0);
    expect(
      appFrames.some((f) => typeof f.context_line === "string" && f.context_line.includes("throw new Error")),
    ).toBe(true);

    // And it still conforms to the wire contract.
    const ok = validateEvent(event);
    if (!ok) console.error(validateEvent.errors);
    expect(ok).toBe(true);
  });
});
