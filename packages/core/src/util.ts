// Drop keys whose value is null/undefined — the JS analogue of Ruby's Hash#compact, which
// the gem's EventBuilder uses so absent fields are omitted from the wire payload rather than
// sent as null.
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

// UUID v4 with hyphens removed — the contract's event_id shape (32 lowercase hex chars).
export function uuid32(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "");
}

// Seconds since the Unix epoch, as a float (matches Ruby's Time.now.to_f).
export function epochSeconds(): number {
  return Date.now() / 1000;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
