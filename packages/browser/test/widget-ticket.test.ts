// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { buildWidgetTicket } from "../src/widget/ticket";

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const ticketSchema = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../../contract/schema/ticket.schema.json", import.meta.url)),
    "utf8",
  ),
);
const validateTicket = ajv.compile(ticketSchema);

describe("buildWidgetTicket", () => {
  it("builds the widget payload and conforms to the contract", () => {
    const payload = buildWidgetTicket({
      description: "When I clicked Save on checkout, the page returned a 500.",
      severity: "high",
      reporter: { email: "casey@example.com", external_id: "u_99" },
      screenshots: [{ filename: "screenshot.png", content_type: "image/png", data: "QUJD" }],
      baseMetadata: { release: "9f8c2a1d", env: "production" },
      labels: ["checkout", "payments"],
      severityHint: "high",
      runtime: {
        url: "https://shop.example.com/checkout",
        userAgent: "UA/1.0",
        viewport: "1920x1080",
        referrer: "https://shop.example.com/cart",
        consoleErrors: ["TypeError: x"],
        userPath: ['a#cart "Cart"', 'button "Checkout"'],
      },
    });

    const ticket = payload.ticket;
    expect(ticket.source).toBe("widget");
    expect(ticket.severity).toBe("high");
    expect(ticket.reporter).toEqual({ email: "casey@example.com", external_id: "u_99" });
    expect(ticket.screenshots).toHaveLength(1);
    const metadata = ticket.metadata as Record<string, unknown>;
    expect(metadata["labels"]).toEqual(["checkout", "payments"]);
    expect(metadata["severity_hint"]).toBe("high");
    expect(metadata["url"]).toBe("https://shop.example.com/checkout");
    expect(metadata["user_path"]).toEqual(['a#cart "Cart"', 'button "Checkout"']);
    expect(metadata["console_errors"]).toEqual(["TypeError: x"]);

    const ok = validateTicket(payload);
    if (!ok) console.error(validateTicket.errors);
    expect(ok).toBe(true);
  });

  it("nulls severity and reporter when absent, and still conforms", () => {
    const payload = buildWidgetTicket({
      description: "hello there",
      screenshots: [],
      baseMetadata: {},
      runtime: { referrer: null, consoleErrors: [], userPath: [] },
    });
    expect(payload.ticket.severity).toBeNull();
    expect(payload.ticket.reporter).toBeNull();
    expect(validateTicket(payload)).toBe(true);
  });
});
