import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { clearSourceCache } from "../src/sourceContext";
import { nodeStackParser } from "../src/stack";

function fixtureRoot(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "dispatch-node-")));
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(
    join(root, "src", "calc.js"),
    [
      "function compute(order) {",
      "  const items = order.items;",
      "  return items.reduce((a, b) => a + b.total, 0);",
      "}",
      "module.exports = { compute };",
      "",
    ].join("\n"),
  );
  return root;
}

afterEach(() => clearSourceCache());

describe("nodeStackParser", () => {
  it("marks app frames in_app with a relative filename and source context", () => {
    const root = fixtureRoot();
    const stack = [
      "TypeError: Cannot read properties of undefined (reading 'total')",
      `    at compute (${root}/src/calc.js:3:30)`,
      `    at Object.<anonymous> (${root}/node_modules/dep/index.js:9:1)`,
    ].join("\n");

    const frames = nodeStackParser(root)(stack);

    // oldest-first: dependency frame, then the app frame (where it threw) last
    const appFrame = frames[frames.length - 1]!;
    expect(appFrame.in_app).toBe(true);
    expect(appFrame.filename).toBe(join("src", "calc.js"));
    expect(appFrame.lineno).toBe(3);
    expect(appFrame.context_line).toContain("items.reduce");
    expect(appFrame.pre_context).toBeDefined();
    expect(appFrame.post_context).toBeDefined();

    const depFrame = frames[0]!;
    expect(depFrame.in_app).toBe(false);
    expect(depFrame.context_line).toBeUndefined();
  });

  it("treats node: internal frames as not in_app", () => {
    const root = fixtureRoot();
    const stack = ["Error", "    at process (node:internal/process/task_queues:9:2)"].join("\n");
    const frames = nodeStackParser(root)(stack);
    expect(frames[0]!.in_app).toBe(false);
  });

  it("resolves file:// URLs and reads their source", () => {
    const root = fixtureRoot();
    const stack = ["Error", `    at compute (file://${root}/src/calc.js:3:30)`].join("\n");
    const frames = nodeStackParser(root)(stack);
    expect(frames[0]!.abs_path).toBe(join(root, "src", "calc.js"));
    expect(frames[0]!.in_app).toBe(true);
    expect(frames[0]!.context_line).toContain("items.reduce");
  });
});
