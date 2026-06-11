import {
  type DispatchConfig,
  type DispatchEvent,
  type TicketPayload,
  type TicketResponse,
  type Transport,
  sdkHeader,
} from "@dispatchitapp/core";

// Browser transport: send each event immediately via fetch with keepalive (survives page
// unload), falling back to navigator.sendBeacon when fetch is unavailable or fails. Beacons
// can't set headers, so the token goes in ?sentry_key= — the same scheme as error_tracker.js.
export class BrowserTransport implements Transport {
  constructor(private readonly config: DispatchConfig) {}

  sendEvent(event: DispatchEvent): void {
    const body = JSON.stringify(event);
    if (!this.fetchSend(this.config.errorEndpoint, body)) {
      this.beacon(this.config.errorEndpoint, body);
    }
  }

  async postTicket(
    payload: TicketPayload,
    options?: { headers?: Record<string, string> },
  ): Promise<TicketResponse | null> {
    const f = globalThis.fetch;
    if (typeof f !== "function") return null;
    try {
      const res = await f(this.config.endpoint, {
        method: "POST",
        mode: "cors",
        headers: { ...this.headers(), ...(options?.headers ?? {}) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return null;
      return (await res.json()) as TicketResponse;
    } catch {
      return null;
    }
  }

  async flush(): Promise<boolean> {
    return true;
  }

  // Returns true if a fetch was initiated (its async failure beacons as a fallback).
  private fetchSend(url: string, body: string): boolean {
    const f = globalThis.fetch;
    if (typeof f !== "function") return false;
    try {
      void f(url, {
        method: "POST",
        keepalive: true,
        mode: "cors",
        headers: this.headers(),
        body,
      }).catch(() => this.beacon(url, body));
      return true;
    } catch {
      return false;
    }
  }

  private beacon(url: string, body: string): void {
    const nav = globalThis.navigator;
    if (!nav || typeof nav.sendBeacon !== "function") return;
    const sep = url.includes("?") ? "&" : "?";
    const beaconUrl = `${url}${sep}sentry_key=${encodeURIComponent(this.config.apiKey)}`;
    const data: BodyInit =
      typeof Blob !== "undefined" ? new Blob([body], { type: "application/json" }) : body;
    try {
      nav.sendBeacon(beaconUrl, data);
    } catch {
      /* nothing more we can do */
    }
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
      "X-Dispatch-Sdk": sdkHeader(this.config),
    };
  }
}
