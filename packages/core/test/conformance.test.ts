// Ties @dispatch/core to the wire contract: events and tickets the core produces must validate
// against contract/schema/*.json. If this fails, core has drifted from the contract.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config";
import { buildEvent } from "../src/event";
import { buildTicketPayload } from "../src/ticket";

function loadSchema(rel: string): object {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateEvent = ajv.compile(loadSchema("../../../contract/schema/event.schema.json"));
const validateTicket = ajv.compile(loadSchema("../../../contract/schema/ticket.schema.json"));

const config = resolveConfig({
  apiKey: "dsp_live_x",
  environment: "production",
  release: "9f8c2a1d",
});
const fixed = { now: () => 1700000000, uuid: () => "0".repeat(32) };

function expectValidEvent(event: unknown) {
  const ok = validateEvent(event);
  if (!ok) console.error(validateEvent.errors);
  expect(ok).toBe(true);
}

describe("core output conforms to the contract", () => {
  it("a simple handled exception validates", () => {
    expectValidEvent(buildEvent(new Error("boom"), { config, handled: true, ...fixed }));
  });

  it("an unhandled exception with a stack validates", () => {
    const err = new Error("Cannot read properties of undefined");
    err.stack = [
      "TypeError: Cannot read properties of undefined",
      "    at computeTotal (https://shop.example.com/assets/checkout.js:42:18)",
      "    at onCheckout (https://shop.example.com/assets/checkout.js:88:5)",
    ].join("\n");
    expectValidEvent(
      buildEvent(err, { config, handled: false, transaction: "checkout", ...fixed }),
    );
  });

  it("a 3-deep cause chain validates", () => {
    const root = new Error("upstream timed out");
    const mid = new Error("reserve failed", { cause: root });
    const top = new Error("update aborted", { cause: mid });
    expectValidEvent(buildEvent(top, { config, handled: false, ...fixed }));
  });

  it("ticket payloads validate", () => {
    const widgetLike = buildTicketPayload({
      description: "When I clicked Save, the page 500'd",
      source: "widget",
      severity: "high",
      reporter: { email: "casey@example.com", external_id: "u_99" },
      metadata: { url: "https://shop.example.com/checkout", labels: ["checkout"] },
    });
    const apiReport = buildTicketPayload({
      description: "Nightly import aborted",
      severity: "high",
      metadata: { job: "ImportJob" },
      correlationId: "abc-123",
    });
    expect(validateTicket(widgetLike)).toBe(true);
    expect(validateTicket(apiReport)).toBe(true);
  });
});
