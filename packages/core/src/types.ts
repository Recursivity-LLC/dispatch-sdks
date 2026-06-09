// Wire types for the Dispatch contract. These mirror contract/schema/event.schema.json and
// contract/schema/ticket.schema.json. Optional fields are omitted from the payload (not sent
// as null) — see util.compact.

export type Level = "fatal" | "error" | "warning" | "info" | "debug";

export type TagValue = string | number | boolean | null;
export type Tags = Record<string, TagValue>;

export interface DispatchFrame {
  abs_path?: string | null;
  filename?: string | null;
  function?: string | null;
  lineno: number;
  colno?: number | null;
  in_app?: boolean;
  pre_context?: string[];
  context_line?: string;
  post_context?: string[];
}

export interface DispatchStacktrace {
  frames: DispatchFrame[];
}

export interface DispatchMechanism {
  type: string;
  handled: boolean;
}

export interface DispatchExceptionValue {
  type: string;
  value: string;
  mechanism: DispatchMechanism;
  stacktrace: DispatchStacktrace;
}

export interface DispatchUser {
  id?: string | null;
  email?: string | null;
  ip_address?: string | null;
}

export interface DispatchRequest {
  url?: string | null;
  method?: string | null;
  query_string?: string | null;
  headers?: Record<string, string>;
  data?: Record<string, unknown> | null;
  env?: Record<string, string>;
}

export interface DispatchSdk {
  name: string;
  version: string;
}

export interface DispatchEvent {
  event_id: string;
  timestamp: number;
  platform: string;
  level: Level;
  environment: string;
  release?: string | null;
  server_name?: string | null;
  transaction?: string | null;
  exception: { values: DispatchExceptionValue[] };
  request?: DispatchRequest;
  user?: DispatchUser;
  tags?: Tags;
  sdk?: DispatchSdk;
}

export interface TicketReporter {
  email?: string | null;
  external_id?: string | null;
}

export interface TicketAttachment {
  filename?: string;
  content_type?: string;
  data: string;
}

export interface TicketBody {
  description: string;
  title?: string;
  source?: string;
  severity?: string | null;
  reporter?: TicketReporter | null;
  metadata?: Record<string, unknown>;
  screenshots?: TicketAttachment[];
  attachments?: TicketAttachment[];
}

export interface TicketPayload {
  ticket: TicketBody;
}

export interface TicketResponse {
  id: number;
  status: string;
  url: string;
}
