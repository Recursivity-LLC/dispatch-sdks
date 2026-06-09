import { describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config";
import { buildEvent } from "../src/event";

const config = resolveConfig({
  apiKey: "dsp_live_x",
  environment: "production",
  release: "9f8c2a1d",
  tags: { service: "checkout" },
});

const fixed = { now: () => 1700000000, uuid: () => "0".repeat(32) };

describe("buildEvent", () => {
  it("builds a Sentry-shaped event from an Error", () => {
    const event = buildEvent(new Error("boom"), { config, handled: true, ...fixed });
    expect(event).toMatchObject({
      event_id: "0".repeat(32),
      timestamp: 1700000000,
      platform: "javascript",
      level: "error",
      environment: "production",
      release: "9f8c2a1d",
      sdk: { name: "dispatch-js" },
    });
    expect(event.exception.values).toHaveLength(1);
    expect(event.exception.values[0]).toMatchObject({
      type: "Error",
      value: "boom",
      mechanism: { type: "generic", handled: true },
    });
  });

  it("orders the cause chain oldest-first, raised-last", () => {
    const root = new Error("upstream timed out");
    const mid = new Error("reserve failed", { cause: root });
    const top = new Error("update aborted", { cause: mid });

    const event = buildEvent(top, { config, handled: false, ...fixed });
    const values = event.exception.values;
    expect(values.map((v) => v.value)).toEqual([
      "upstream timed out",
      "reserve failed",
      "update aborted",
    ]);
    expect(values.every((v) => v.mechanism.handled === false)).toBe(true);
  });

  it("caps the cause chain at 5", () => {
    let err = new Error("c0");
    for (let i = 1; i < 10; i++) err = new Error(`c${i}`, { cause: err });
    const event = buildEvent(err, { config, handled: true, ...fixed });
    expect(event.exception.values).toHaveLength(5);
  });

  it("truncates the message to 2000 chars", () => {
    const event = buildEvent(new Error("x".repeat(2500)), { config, handled: true, ...fixed });
    expect(event.exception.values[0]!.value).toHaveLength(2000);
  });

  it("merges derived, config and explicit tags (explicit wins)", () => {
    const event = buildEvent(new Error("e"), {
      config,
      handled: true,
      transaction: "orders#update",
      tags: { service: "override", area: "import" },
      ...fixed,
    });
    expect(event.transaction).toBe("orders#update");
    expect(event.tags).toMatchObject({
      transaction: "orders#update",
      service: "override",
      area: "import",
    });
  });

  it("handles non-Error throwables", () => {
    const event = buildEvent("just a string", { config, handled: false, ...fixed });
    expect(event.exception.values[0]).toMatchObject({ type: "Error", value: "just a string" });
  });

  it("omits absent optional fields rather than sending null", () => {
    const minimal = resolveConfig({ apiKey: "x", environment: "production" });
    const event = buildEvent(new Error("e"), { config: minimal, handled: true, ...fixed });
    expect("release" in event).toBe(false);
    expect("server_name" in event).toBe(false);
    expect("user" in event).toBe(false);
  });
});
