import { describe, expect, it } from "vitest";
import { sampledOut } from "../src/sampling";

describe("sampledOut", () => {
  it("keeps everything at rate >= 1", () => {
    expect(sampledOut(1, () => 0.999999)).toBe(false);
    expect(sampledOut(2, () => 0.999999)).toBe(false);
  });

  it("drops everything at rate <= 0", () => {
    expect(sampledOut(0, () => 0)).toBe(true);
    expect(sampledOut(-1, () => 0)).toBe(true);
  });

  it("keeps when rng <= rate, drops when rng > rate", () => {
    expect(sampledOut(0.5, () => 0.4)).toBe(false);
    expect(sampledOut(0.5, () => 0.6)).toBe(true);
  });
});
