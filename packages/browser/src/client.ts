import {
  type DispatchConfig,
  type DispatchEvent,
  type DispatchOptions,
  type DispatchUser,
  type Level,
  type Tags,
  type Transport,
  alreadyCaptured,
  environmentEnabled,
  errorTrackingEnabled,
  markCaptured,
  resolveConfig,
  sampledOut,
} from "@dispatchitapp/core";
import { type Breadcrumb, BreadcrumbBuffer } from "./breadcrumbs";
import { buildBrowserEvent } from "./event";
import { type HandlerHost, installBrowserHandlers } from "./handlers";
import { BrowserTransport } from "./transport";
import { SDK_NAME, SDK_VERSION } from "./version";

export interface BrowserOptions extends DispatchOptions {
  /** Override the transport (tests, or a custom transport). */
  transport?: Transport;
  /** Injectable RNG for deterministic sampling in tests. */
  rng?: () => number;
  /** Track clicks as breadcrumbs / user_path. Default true. */
  captureClicks?: boolean;
  /** Capture console.error calls as breadcrumbs. Default false. */
  captureConsole?: boolean;
  /** Breadcrumb ring-buffer size. Default 30. */
  maxBreadcrumbs?: number;
  /** Install window handlers on construction (via init). Default true. */
  autoInstall?: boolean;
}

export interface BrowserCaptureContext {
  /** Capture mechanism: "generic" (manual, default), "onerror", "onunhandledrejection". */
  mechanismType?: string;
  /** Default true for manual capture; the handlers pass false. */
  handled?: boolean;
  level?: Level;
  user?: DispatchUser | null;
  tags?: Tags;
}

export class BrowserClient implements HandlerHost {
  readonly config: DispatchConfig;
  readonly transport: Transport;
  readonly breadcrumbs: BreadcrumbBuffer;
  readonly captureClicks: boolean;
  readonly captureConsole: boolean;
  private readonly rng: () => number;
  private uninstall: (() => void) | null = null;

  constructor(options: BrowserOptions) {
    this.config = resolveConfig({
      ...options,
      sdk: options.sdk ?? { name: SDK_NAME, version: SDK_VERSION },
    });
    this.transport = options.transport ?? new BrowserTransport(this.config);
    this.breadcrumbs = new BreadcrumbBuffer(options.maxBreadcrumbs);
    this.captureClicks = options.captureClicks ?? true;
    this.captureConsole = options.captureConsole ?? false;
    this.rng = options.rng ?? Math.random;
  }

  captureException(error: unknown, context: BrowserCaptureContext = {}): void {
    try {
      const c = this.config;
      if (!errorTrackingEnabled(c)) return;
      if (!environmentEnabled(c)) return;
      if (alreadyCaptured(error)) return;
      if (sampledOut(c.errorSampleRate, this.rng)) return;
      markCaptured(error);

      let event: DispatchEvent = buildBrowserEvent(error, {
        config: c,
        mechanismType: context.mechanismType ?? "generic",
        handled: context.handled ?? true,
        level: context.level,
        breadcrumbs: this.breadcrumbs.snapshot(),
        userPath: this.breadcrumbs.userPath(),
        user: context.user,
        tags: context.tags,
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

  addBreadcrumb(crumb: Breadcrumb): void {
    this.breadcrumbs.add(crumb);
  }

  installHandlers(): void {
    if (this.uninstall) return;
    this.uninstall = installBrowserHandlers(this);
  }

  removeHandlers(): void {
    this.uninstall?.();
    this.uninstall = null;
  }
}
