import { describe, expect, it } from "vitest";
import { buildTicketPayload } from "../src/ticket";

describe("buildTicketPayload", () => {
  it("builds a minimal { ticket } body with default source", () => {
    const payload = buildTicketPayload({ description: "Nightly import aborted" });
    expect(payload).toEqual({ ticket: { description: "Nightly import aborted", source: "api" } });
  });

  it("folds correlationId into metadata", () => {
    const payload = buildTicketPayload({
      description: "boom",
      severity: "high",
      metadata: { job: "ImportJob" },
      correlationId: "abc-123",
    });
    expect(payload.ticket).toMatchObject({
      description: "boom",
      severity: "high",
      metadata: { job: "ImportJob", correlation_id: "abc-123" },
    });
  });

  it("omits empty metadata and absent reporter", () => {
    const payload = buildTicketPayload({ description: "x" });
    expect("metadata" in payload.ticket).toBe(false);
    expect("reporter" in payload.ticket).toBe(false);
  });

  it("passes through a reporter", () => {
    const payload = buildTicketPayload({
      description: "x",
      reporter: { email: "casey@example.com", external_id: "u_99" },
    });
    expect(payload.ticket.reporter).toEqual({ email: "casey@example.com", external_id: "u_99" });
  });
});
