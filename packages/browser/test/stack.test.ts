import { describe, expect, it } from "vitest";
import { parseStack } from "../src/stack";

describe("parseStack (browser)", () => {
  it("parses a Chrome/V8 stack oldest-first with columns", () => {
    const stack = [
      "TypeError: Cannot read properties of undefined (reading 'total')",
      "    at computeTotal (https://shop.example.com/assets/checkout.js:42:18)",
      "    at HTMLButtonElement.onCheckout (https://shop.example.com/assets/checkout.js:88:5)",
    ].join("\n");
    const frames = parseStack(stack);
    expect(frames).toHaveLength(2);
    expect(frames[0]).toMatchObject({
      function: "HTMLButtonElement.onCheckout",
      lineno: 88,
      colno: 5,
      in_app: true,
    });
    expect(frames[1]).toMatchObject({
      function: "computeTotal",
      filename: "https://shop.example.com/assets/checkout.js",
      lineno: 42,
      colno: 18,
      in_app: true,
    });
  });

  it("parses Firefox/Safari stacks (fn@ and global @)", () => {
    const stack = ["callGateway@https://x/payments.js:64:22", "@https://x/checkout.js:120:11"].join(
      "\n",
    );
    const frames = parseStack(stack);
    expect(frames[0]).toMatchObject({ function: "?", lineno: 120, colno: 11 });
    expect(frames[1]).toMatchObject({ function: "callGateway", lineno: 64, colno: 22 });
  });

  it("handles async and anonymous V8 frames", () => {
    const stack = [
      "Error: x",
      "    at async load (https://x/app.js:5:1)",
      "    at https://x/app.js:9:2",
    ].join("\n");
    const frames = parseStack(stack);
    expect(frames[0]).toMatchObject({ function: "?", lineno: 9 });
    expect(frames[1]).toMatchObject({ function: "load", lineno: 5 });
  });

  it("marks node_modules and non-http frames as not in_app", () => {
    const stack = [
      "Error",
      "    at f (https://x/node_modules/dep/index.js:1:1)",
      "    at g (webpack-internal:///./src/a.js:2:2)",
    ].join("\n");
    const frames = parseStack(stack);
    expect(frames.every((f) => f.in_app === false)).toBe(true);
  });

  it("returns [] for an empty stack", () => {
    expect(parseStack(undefined)).toEqual([]);
    expect(parseStack("")).toEqual([]);
  });
});
