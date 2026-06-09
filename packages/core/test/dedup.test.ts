import { describe, expect, it } from "vitest";
import { alreadyCaptured, markCaptured } from "../src/dedup";

describe("dedup", () => {
  it("tracks an error object once marked", () => {
    const err = new Error("boom");
    expect(alreadyCaptured(err)).toBe(false);
    markCaptured(err);
    expect(alreadyCaptured(err)).toBe(true);
  });

  it("treats distinct instances independently", () => {
    const a = new Error("a");
    const b = new Error("b");
    markCaptured(a);
    expect(alreadyCaptured(b)).toBe(false);
  });

  it("ignores non-objects without throwing", () => {
    expect(alreadyCaptured("nope")).toBe(false);
    expect(() => markCaptured("nope")).not.toThrow();
    expect(alreadyCaptured(null)).toBe(false);
  });
});
