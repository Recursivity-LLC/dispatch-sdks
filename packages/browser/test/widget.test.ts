import type { TicketPayload, TicketResponse } from "@dispatch/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Widget, type WidgetOptions } from "../src/widget/Widget";

interface Recorded {
  payload: TicketPayload;
  headers: Record<string, string>;
}

const mounted: Widget[] = [];

function mountWidget(overrides: Partial<WidgetOptions> = {}): {
  widget: Widget;
  submitted: Recorded[];
} {
  const submitted: Recorded[] = [];
  const widget = new Widget({
    apiKey: "x",
    endpoint: "https://acme.dispatchit.app/api/v1/tickets",
    environment: "production",
    uuid: () => "fixed-uuid",
    readFile: async () => "data:image/png;base64,QUJD",
    submit: async (payload, headers): Promise<TicketResponse | null> => {
      submitted.push({ payload, headers });
      return { id: 1, status: "inbox", url: "u" };
    },
    ...overrides,
  }).mount();
  mounted.push(widget);
  return { widget, submitted };
}

function buttonByText(text: string): HTMLButtonElement {
  const found = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === text);
  if (!found) throw new Error(`no button with text "${text}"`);
  return found as HTMLButtonElement;
}

function ticketOf(rec: Recorded): Record<string, any> {
  return rec.payload.ticket as unknown as Record<string, any>;
}

afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount();
  document.body.replaceChildren();
});

describe("Widget", () => {
  it("mounts a floating 🐞 button and a hidden modal", () => {
    mountWidget();
    const button = document.querySelector<HTMLButtonElement>("[aria-label='Report a bug']");
    expect(button?.textContent).toBe("🐞");
    const modal = document.querySelector<HTMLElement>("[data-dispatch-widget] > div");
    expect(modal?.hidden).toBe(true);
  });

  it("opens the modal on button click", () => {
    mountWidget();
    document.querySelector<HTMLButtonElement>("[aria-label='Report a bug']")!.click();
    const modal = document.querySelector<HTMLElement>("[data-dispatch-widget] > div");
    expect(modal?.hidden).toBe(false);
  });

  it("requires at least 5 characters before submitting", async () => {
    const { submitted } = mountWidget();
    document.querySelector<HTMLTextAreaElement>("textarea")!.value = "no";
    buttonByText("Report").click();
    await Promise.resolve();
    expect(submitted).toHaveLength(0);
    // the error node is the shown (display:block) div carrying the message
    const errorEl = Array.from(document.querySelectorAll("div")).find(
      (d) => d.style.display === "block" && (d.textContent ?? "").includes("at least 5"),
    );
    expect(errorEl).toBeTruthy();
  });

  it("submits a widget ticket with runtime metadata and the widget headers", async () => {
    const { submitted } = mountWidget();
    document.querySelector<HTMLTextAreaElement>("textarea")!.value =
      "When I clicked Save the page 500'd";
    buttonByText("Report").click();
    await vi.waitFor(() => expect(submitted).toHaveLength(1));

    const ticket = ticketOf(submitted[0]!);
    expect(ticket.source).toBe("widget");
    expect(ticket.description).toBe("When I clicked Save the page 500'd");
    expect(ticket.metadata.url).toMatch(/^http/);
    expect(ticket.metadata.viewport).toMatch(/^\d+x\d+$/);
    expect(ticket.metadata).toHaveProperty("user_path");
    expect(submitted[0]!.headers["Idempotency-Key"]).toBe("fixed-uuid");
    expect(submitted[0]!.headers["X-Dispatch-Widget-Version"]).toBeTruthy();

    // success closes the modal and shows the toast
    const modal = document.querySelector<HTMLElement>("[data-dispatch-widget] > div");
    expect(modal?.hidden).toBe(true);
  });

  it("attaches screenshots and includes them in the payload", async () => {
    const { widget, submitted } = mountWidget();
    const file = new File([new Uint8Array([1, 2, 3])], "shot.png", { type: "image/png" });
    await widget.addFiles([file]);

    expect(document.querySelector("[data-dispatch-widget]")!.querySelectorAll("img")).toHaveLength(1);
    expect(buttonByText("📎 Attach screenshots (1/5)")).toBeTruthy();

    document.querySelector<HTMLTextAreaElement>("textarea")!.value = "here is a screenshot report";
    buttonByText("Report").click();
    await vi.waitFor(() => expect(submitted).toHaveLength(1));
    const ticket = ticketOf(submitted[0]!);
    expect(ticket.screenshots).toEqual([
      { filename: "shot.png", content_type: "image/png", data: "QUJD" },
    ]);
  });

  it("rejects non-image attachments", async () => {
    const { widget } = mountWidget();
    await widget.addFiles([new File(["x"], "notes.txt", { type: "text/plain" })]);
    expect(document.querySelector("[data-dispatch-widget]")!.querySelectorAll("img")).toHaveLength(0);
  });

  it("tracks the click path (skipping clicks inside the widget)", async () => {
    const { submitted } = mountWidget();
    // a click inside the widget (the button) must NOT enter the path
    document.querySelector<HTMLButtonElement>("[aria-label='Report a bug']")!.click();
    // a click outside the widget does
    const outside = document.createElement("button");
    outside.textContent = "Checkout";
    document.body.appendChild(outside);
    outside.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    document.querySelector<HTMLTextAreaElement>("textarea")!.value = "report after clicking around";
    buttonByText("Report").click();
    await vi.waitFor(() => expect(submitted).toHaveLength(1));
    const userPath = ticketOf(submitted[0]!).metadata.user_path as string[];
    expect(userPath).toContain('button "Checkout"');
    expect(userPath.some((p) => p.includes("Report a bug") || p === "🐞")).toBe(false);
  });

  it("captures console.error when enabled and restores it on unmount", async () => {
    const original = console.error;
    const { widget, submitted } = mountWidget({ captureConsole: true });
    expect(console.error).not.toBe(original);

    console.error("widget-test-boom");
    document.querySelector<HTMLTextAreaElement>("textarea")!.value = "console capture report";
    buttonByText("Report").click();
    await vi.waitFor(() => expect(submitted).toHaveLength(1));
    expect(ticketOf(submitted[0]!).metadata.console_errors).toContain("widget-test-boom");

    widget.unmount();
    mounted.pop(); // already unmounted
    expect(console.error).toBe(original);
  });
});
