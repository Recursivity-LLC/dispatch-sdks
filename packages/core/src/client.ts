import {
  type DispatchConfig,
  type DispatchOptions,
  configured,
  environmentEnabled,
  errorTrackingEnabled,
  resolveConfig,
} from "./config";
import { alreadyCaptured, markCaptured } from "./dedup";
import { buildEvent } from "./event";
import { sampledOut } from "./sampling";
import { type ReportInput, buildTicketPayload } from "./ticket";
import { FetchTransport, type Transport } from "./transport";
import type {
  DispatchFrame,
  DispatchRequest,
  DispatchUser,
  Level,
  Tags,
  TicketResponse,
} from "./types";

export interface CaptureContext {
  level?: Level;
  /** Defaults to true for manual capture; framework handlers pass false for unhandled errors. */
  handled?: boolean;
  user?: DispatchUser | null;
  tags?: Tags;
  request?: DispatchRequest;
  transaction?: string | null;
  serverName?: string | null;
}

export interface ClientOptions extends DispatchOptions {
  /** Override the transport (tests, or a runtime-specific transport). */
  transport?: Transport;
  /** The originating runtime written into event.platform. Default "javascript". */
  platform?: string;
  /** Injectable stack parser (e.g. the Node V8 parser, or a browser parser). */
  parseStack?: (stack?: string | null) => DispatchFrame[];
  /** Injectable RNG for deterministic sampling in tests. */
  rng?: () => number;
}

// The capture pipeline, mirroring the gem's Reporter + the top-level Dispatch::Rails API:
// gate on config/environment, dedup, sample, build, before_send, deliver — and NEVER throw.
export class Client {
  readonly config: DispatchConfig;
  readonly transport: Transport;
  private readonly platform: string;
  private readonly parseStack: ((stack?: string | null) => DispatchFrame[]) | undefined;
  private readonly rng: () => number;

  constructor(options: ClientOptions) {
    this.config = resolveConfig(options);
    this.transport = options.transport ?? new FetchTransport(this.config);
    this.platform = options.platform ?? "javascript";
    this.parseStack = options.parseStack;
    this.rng = options.rng ?? Math.random;
  }

  captureException(error: unknown, context: CaptureContext = {}): void {
    try {
      const c = this.config;
      if (!errorTrackingEnabled(c)) return;
      if (!environmentEnabled(c)) return;
      if (alreadyCaptured(error)) return;
      if (sampledOut(c.errorSampleRate, this.rng)) return;
      markCaptured(error);

      let event = buildEvent(error, {
        config: c,
        platform: this.platform,
        level: context.level ?? "error",
        handled: context.handled ?? true,
        user: context.user,
        tags: context.tags,
        request: context.request,
        transaction: context.transaction,
        serverName: context.serverName,
        parseStack: this.parseStack,
      });

      if (c.beforeSend) {
        const result = c.beforeSend(event);
        if (!result) return;
        event = result;
      }

      this.transport.sendEvent(event);
    } catch (err) {
      if (this.config.debug) console.warn(`[dispatch] capture failed: ${String(err)}`);
    }
  }

  async report(input: ReportInput): Promise<TicketResponse | null> {
    if (!configured(this.config)) return null;
    try {
      return await this.transport.postTicket(buildTicketPayload(input));
    } catch {
      return null;
    }
  }

  flush(timeoutMs?: number): Promise<boolean> {
    return this.transport.flush(timeoutMs);
  }

  close(timeoutMs?: number): Promise<boolean> {
    return this.transport.flush(timeoutMs);
  }
}
