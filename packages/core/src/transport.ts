import type { DispatchConfig } from "./config";
import type { DispatchEvent, TicketPayload, TicketResponse } from "./types";
import { CONTRACT_VERSION } from "./version";
import { delay } from "./util";

export const QUEUE_LIMIT = 100;
export const DEFAULT_FLUSH_TIMEOUT = 2000;

export interface Transport {
  /** Enqueue an error event for asynchronous delivery (off the hot path). */
  sendEvent(event: DispatchEvent): void;
  /** Synchronously POST a ticket and return the parsed response (or null on failure). */
  postTicket(payload: TicketPayload): Promise<TicketResponse | null>;
  /** Resolve once the queue has drained (or the timeout elapses). */
  flush(timeoutMs?: number): Promise<boolean>;
}

export type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string; keepalive?: boolean },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

// "dispatch-node/1.2.0 (contract/1)" — lets the backend observe the SDK + contract version.
export function sdkHeader(config: DispatchConfig): string {
  return `${config.sdk.name}/${config.sdk.version} (contract/${CONTRACT_VERSION})`;
}

// A bounded, fire-and-forget transport built on the global fetch (present in Node 18+ and all
// browsers). Mirrors the gem's Transport: a bounded queue (drop-on-overflow, never blocks the
// caller) drained sequentially; failures are swallowed so telemetry never breaks the app.
// Runtime packages can subclass/replace this (Node adds flush-on-exit; browser adds beacons).
export class FetchTransport implements Transport {
  private queue: DispatchEvent[] = [];
  private draining: Promise<void> | null = null;
  private readonly fetchImpl: FetchLike | undefined;

  constructor(
    protected readonly config: DispatchConfig,
    fetchImpl?: FetchLike,
  ) {
    this.fetchImpl =
      fetchImpl ?? (globalThis.fetch as unknown as FetchLike | undefined);
  }

  sendEvent(event: DispatchEvent): void {
    if (this.queue.length >= QUEUE_LIMIT) {
      this.warn(`queue full (${QUEUE_LIMIT}), dropping event ${event.event_id}`);
      return;
    }
    this.queue.push(event);
    this.kick();
  }

  async postTicket(payload: TicketPayload): Promise<TicketResponse | null> {
    const res = await this.post(this.config.endpoint, payload);
    if (!res || !res.ok) return null;
    try {
      return (await res.json()) as TicketResponse;
    } catch {
      return null;
    }
  }

  async flush(timeoutMs: number = DEFAULT_FLUSH_TIMEOUT): Promise<boolean> {
    if (this.draining) {
      await Promise.race([this.draining, delay(timeoutMs)]);
    }
    return this.queue.length === 0;
  }

  private kick(): void {
    if (this.draining) return;
    this.draining = this.drain().finally(() => {
      this.draining = null;
    });
  }

  private async drain(): Promise<void> {
    while (this.queue.length > 0) {
      const event = this.queue.shift()!;
      await this.post(this.config.errorEndpoint, event);
    }
  }

  protected async post(
    url: string,
    body: unknown,
  ): Promise<{ ok: boolean; status: number; json(): Promise<unknown> } | null> {
    if (!this.fetchImpl) {
      this.warn("no fetch implementation available");
      return null;
    }
    try {
      return await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
          "X-Dispatch-Sdk": sdkHeader(this.config),
        },
        body: JSON.stringify(body),
        keepalive: true,
      });
    } catch (err) {
      this.warn(`delivery failed: ${String(err)}`);
      return null;
    }
  }

  protected warn(message: string): void {
    if (this.config.debug) console.warn(`[dispatch] ${message}`);
  }
}
