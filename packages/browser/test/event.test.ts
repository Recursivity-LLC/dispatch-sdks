import { resolveConfig } from "@dispatch/core";
import { describe, expect, it } from "vitest";
import { buildBrowserEvent } from "../src/event";

const config = resolveConfig({
  apiKey: "x",
  environment: "production",
  release: "9f8c2a1d",
  endpoint: "https://acme.dispatchit.app/api/v1/tickets",
  tags: { area: "checkout" },
  sdk: { name: "dispatch-browser", version: "test" },
});

const fixed = {
  now: () => 1700000000,
  uuid: () => "0".repeat(32),
  url: "https://shop.example.com/checkout",
  userAgent: "UA/1.0",
};

describe("buildBrowserEvent", () => {
  it("builds a javascript event with mechanism, request, breadcrumbs and user_path", () => {
    const err = new Error("boom");
    err.stack = "Error: boom\n    at f (https://shop.example.com/a.js:2:3)";
    const event = buildBrowserEvent(err, {
      config,
      mechanismType: "onerror",
      handled: false,
      breadcrumbs: [{ timestamp: 1, category: "ui.click", level: "info", message: 'button "Pay"' }],
      userPath: ['button "Pay"'],
      ...fixed,
    });

    expect(event.platform).toBe("javascript");
    expect(event.exception.values[0]!.mechanism).toEqual({ type: "onerror", handled: false });
    expect(event.request).toEqual({
      url: "https://shop.example.com/checkout",
      headers: { "User-Agent": "UA/1.0" },
    });
    expect(event.breadcrumbs?.values).toHaveLength(1);
    expect(event.user_path).toEqual(['button "Pay"']);
    expect(event.tags).toMatchObject({ area: "checkout" });
    expect(event.sdk?.name).toBe("dispatch-browser");
  });

  it("walks the cause chain oldest-first with the rejection mechanism", () => {
    const root = new Error("root");
    const top = new Error("top", { cause: root });
    const event = buildBrowserEvent(top, {
      config,
      mechanismType: "onunhandledrejection",
      handled: false,
      ...fixed,
    });
    expect(event.exception.values.map((v) => v.value)).toEqual(["root", "top"]);
    expect(event.exception.values[0]!.mechanism.type).toBe("onunhandledrejection");
  });

  it("truncates the message to 2000 chars", () => {
    const event = buildBrowserEvent(new Error("x".repeat(2500)), {
      config,
      mechanismType: "generic",
      handled: true,
      ...fixed,
    });
    expect(event.exception.values[0]!.value).toHaveLength(2000);
  });

  it("handles a string rejection reason", () => {
    const event = buildBrowserEvent("just a string", {
      config,
      mechanismType: "onunhandledrejection",
      handled: false,
      ...fixed,
    });
    expect(event.exception.values[0]).toMatchObject({ type: "Error", value: "just a string" });
  });
});
