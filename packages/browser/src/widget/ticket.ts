import type { TicketPayload } from "@dispatch/core";

export const WIDGET_VERSION = "1.0.0-alpha.0";

export interface WidgetScreenshot {
  filename: string;
  content_type: string;
  data: string;
}

export interface BuildWidgetTicketInput {
  description: string;
  severity?: string | null;
  reporter?: Record<string, unknown> | null;
  screenshots: WidgetScreenshot[];
  baseMetadata: Record<string, unknown>;
  labels?: string[];
  severityHint?: string;
  runtime: {
    url?: string;
    userAgent?: string;
    viewport?: string;
    referrer?: string | null;
    consoleErrors: string[];
    userPath: string[];
  };
}

// Build the widget's { ticket } body. Mirrors the gem's widget.js submit payload (note the
// long-standing `screenshots` key, and metadata enriched with url/user_agent/viewport/referrer/
// user_path/console_errors). Matches contract/fixtures/ticket.widget.json.
export function buildWidgetTicket(input: BuildWidgetTicketInput): TicketPayload {
  const metadata: Record<string, unknown> = { ...input.baseMetadata };
  if (input.labels && input.labels.length > 0) metadata["labels"] = input.labels;
  if (input.severityHint) metadata["severity_hint"] = input.severityHint;
  if (input.runtime.url !== undefined) metadata["url"] = input.runtime.url;
  if (input.runtime.userAgent !== undefined) metadata["user_agent"] = input.runtime.userAgent;
  if (input.runtime.viewport !== undefined) metadata["viewport"] = input.runtime.viewport;
  metadata["referrer"] = input.runtime.referrer ?? null;
  metadata["console_errors"] = input.runtime.consoleErrors;
  metadata["user_path"] = input.runtime.userPath;

  const reporter =
    input.reporter && Object.keys(input.reporter).length > 0 ? input.reporter : null;

  const ticket = {
    description: input.description,
    source: "widget",
    severity: input.severity ?? null,
    reporter,
    screenshots: input.screenshots,
    metadata,
  };

  return { ticket } as unknown as TicketPayload;
}
