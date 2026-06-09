import { describe, expect, it } from "vitest";
import { parseStack } from "../src/stacktrace";

describe("parseStack", () => {
  it("parses a V8 (Chrome/Node) stack, oldest frame last", () => {
    const stack = [
      "TypeError: Cannot read properties of undefined (reading 'total')",
      "    at computeTotal (https://shop.example.com/assets/checkout.js:42:18)",
      "    at onCheckout (https://shop.example.com/assets/checkout.js:88:5)",
    ].join("\n");

    const frames = parseStack(stack);
    expect(frames).toHaveLength(2);
    // oldest first: onCheckout (outer) then computeTotal (where it threw)
    expect(frames[0]).toMatchObject({ function: "onCheckout", lineno: 88, colno: 5, in_app: true });
    expect(frames[1]).toMatchObject({
      function: "computeTotal",
      filename: "https://shop.example.com/assets/checkout.js",
      lineno: 42,
      colno: 18,
      in_app: true,
    });
  });

  it("parses an anonymous V8 frame (no function)", () => {
    const frames = parseStack("Error: x\n    at /srv/app/index.js:10:3");
    expect(frames[0]).toMatchObject({ function: "?", filename: "/srv/app/index.js", lineno: 10 });
  });

  it("parses a Firefox/Safari stack", () => {
    const stack = ["callGateway@https://x/payments.js:64:22", "@https://x/checkout.js:120:11"].join(
      "\n",
    );
    const frames = parseStack(stack);
    expect(frames).toHaveLength(2);
    expect(frames[0]).toMatchObject({ function: "?", lineno: 120, colno: 11 });
    expect(frames[1]).toMatchObject({ function: "callGateway", lineno: 64, colno: 22 });
  });

  it("flags node_modules and node internals as not in_app", () => {
    const stack = [
      "Error",
      "    at handler (/srv/app/node_modules/express/lib/router.js:5:1)",
      "    at process (node:internal/process/task_queues:9:2)",
    ].join("\n");
    const frames = parseStack(stack);
    expect(frames.every((f) => f.in_app === false)).toBe(true);
  });

  it("returns [] for an empty/absent stack", () => {
    expect(parseStack(undefined)).toEqual([]);
    expect(parseStack("")).toEqual([]);
  });
});
