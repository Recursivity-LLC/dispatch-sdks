import type { TicketAttachment, TicketPayload, TicketReporter } from "./types";
import { compact } from "./util";

export interface ReportInput {
  /** Required. The human-readable description of the issue. */
  description: string;
  title?: string;
  /** One of low/medium/high/critical. Unknown values are dropped server-side. */
  severity?: string | null;
  /** Origin of the report. Default "api". */
  source?: string;
  metadata?: Record<string, unknown>;
  reporter?: TicketReporter | null;
  /** Links the ticket to an already-captured error group (e.g. a request id or event_id). */
  correlationId?: string | null;
  attachments?: TicketAttachment[];
}

// Build the { ticket: {...} } body for the tickets endpoint. Mirrors Dispatch::Rails.report:
// correlation_id is folded into metadata, and absent fields are omitted.
export function buildTicketPayload(input: ReportInput): TicketPayload {
  const metadata: Record<string, unknown> = { ...(input.metadata ?? {}) };
  if (input.correlationId) metadata["correlation_id"] = input.correlationId;

  const ticket = compact({
    description: input.description,
    title: input.title,
    source: input.source ?? "api",
    severity: input.severity ?? undefined,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    reporter: input.reporter ?? undefined,
    attachments: input.attachments,
  });

  return { ticket } as TicketPayload;
}
