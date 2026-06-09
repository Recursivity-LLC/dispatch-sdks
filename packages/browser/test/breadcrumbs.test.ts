import { describe, expect, it } from "vitest";
import { BreadcrumbBuffer, describeClickTarget } from "../src/breadcrumbs";

describe("BreadcrumbBuffer", () => {
  it("caps the buffer and returns the user path of clicks only", () => {
    const buffer = new BreadcrumbBuffer(3);
    buffer.add({ timestamp: 1, category: "ui.click", level: "info", message: "a" });
    buffer.add({ timestamp: 2, category: "console", level: "error", message: "boom" });
    buffer.add({ timestamp: 3, category: "ui.click", level: "info", message: "b" });
    buffer.add({ timestamp: 4, category: "ui.click", level: "info", message: "c" });

    expect(buffer.snapshot()).toHaveLength(3); // oldest ("a") dropped
    expect(buffer.userPath()).toEqual(["b", "c"]);
  });
});

describe("describeClickTarget", () => {
  it("labels a button by its text", () => {
    const btn = document.createElement("button");
    btn.textContent = "Checkout";
    expect(describeClickTarget(btn)).toBe('button "Checkout"');
  });

  it("walks up to the nearest interactive ancestor", () => {
    const link = document.createElement("a");
    link.id = "cart";
    const span = document.createElement("span");
    span.textContent = "Cart";
    link.appendChild(span);
    expect(describeClickTarget(span)).toBe('a#cart "Cart"');
  });

  it("returns null for non-elements", () => {
    expect(describeClickTarget(null)).toBeNull();
    expect(describeClickTarget("nope")).toBeNull();
  });
});
