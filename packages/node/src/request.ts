import type { DispatchRequest, DispatchUser } from "@dispatchitapp/core";

// The header allow-list, lowercased (Node lowercases header keys) → canonical wire name.
// Same set as the gem's EventBuilder::SAFE_HEADERS.
const SAFE_HEADERS: Array<[string, string]> = [
  ["user-agent", "User-Agent"],
  ["referer", "Referer"],
  ["accept", "Accept"],
  ["content-type", "Content-Type"],
  ["host", "Host"],
  ["x-request-id", "X-Request-Id"],
];

type HeaderBag = Record<string, string | string[] | undefined>;

// The slice of a Node/Express/Fastify request we read. Kept structural so we depend on no
// framework types.
export interface HttpRequestLike {
  method?: string;
  url?: string;
  originalUrl?: string;
  headers?: HeaderBag;
  protocol?: string;
  ip?: string;
  socket?: { remoteAddress?: string; encrypted?: boolean };
}

function headerValue(headers: HeaderBag, name: string): string | undefined {
  const value = headers[name];
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

function safeHeaders(headers: HeaderBag): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [lower, canonical] of SAFE_HEADERS) {
    const value = headers[lower];
    if (value === undefined) continue;
    out[canonical] = Array.isArray(value) ? value.join(", ") : value;
  }
  return out;
}

// Build the contract `request` object from a Node-style request. Best-effort and never throws;
// only allow-listed headers are included. Mirrors EventBuilder#request_hash.
export function extractRequest(req: HttpRequestLike): DispatchRequest {
  const headers = req.headers ?? {};
  const rawUrl = req.originalUrl ?? req.url ?? "";
  const q = rawUrl.indexOf("?");
  const path = q >= 0 ? rawUrl.slice(0, q) : rawUrl;
  const query = q >= 0 ? rawUrl.slice(q + 1) : undefined;

  const host = headerValue(headers, "host");
  const scheme =
    req.protocol ||
    headerValue(headers, "x-forwarded-proto") ||
    (req.socket?.encrypted ? "https" : "http");
  const forwarded = headerValue(headers, "x-forwarded-for");
  const ip =
    req.ip ||
    req.socket?.remoteAddress ||
    (forwarded ? forwarded.split(",")[0]!.trim() : undefined);

  const out: DispatchRequest = {};
  const url = host ? `${scheme}://${host}${path}` : path || undefined;
  if (url) out.url = url;
  if (req.method) out.method = req.method;
  if (query) out.query_string = query;
  const hdrs = safeHeaders(headers);
  if (Object.keys(hdrs).length > 0) out.headers = hdrs;
  if (ip) out.env = { REMOTE_ADDR: ip };
  return out;
}

// Normalise a resolved user object (from a `user` callback or req.user) into the contract's
// { id, email } shape — accepting both `id` and the gem's `external_id`. Returns undefined when
// there's nothing usable, so the event falls back to the configured user.
export function normalizeUser(user: unknown): DispatchUser | undefined {
  if (user === null || typeof user !== "object") return undefined;
  const u = user as Record<string, unknown>;
  const id = u["id"] ?? u["external_id"];
  const out: DispatchUser = {};
  if (id !== undefined && id !== null) out.id = String(id);
  if (typeof u["email"] === "string") out.email = u["email"];
  return out.id !== undefined || out.email !== undefined ? out : undefined;
}
