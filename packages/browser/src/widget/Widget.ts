import {
  type DispatchOptions,
  type TicketPayload,
  type TicketResponse,
  resolveConfig,
} from "@dispatch/core";
import { describeClickTarget } from "../breadcrumbs";
import { BrowserTransport } from "../transport";
import { type WidgetRefs, buildWidgetDom } from "./render";
import { STYLES } from "./styles";
import type { ButtonPosition } from "./styles";
import { WIDGET_VERSION, type WidgetScreenshot, buildWidgetTicket } from "./ticket";

const CONSOLE_CAPTURE_MAX = 20;
const CLICK_PATH_MAX = 5;
const MAX_SCREENSHOTS = 5;
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

type UserResolver = Record<string, unknown> | (() => Record<string, unknown> | null) | null;
type MetadataResolver = Record<string, unknown> | (() => Record<string, unknown>);
type SubmitFn = (
  payload: TicketPayload,
  headers: Record<string, string>,
) => Promise<TicketResponse | null>;

export interface WidgetOptions
  extends Pick<DispatchOptions, "apiKey" | "endpoint" | "errorEndpoint" | "environment" | "release" | "tags"> {
  /** Resolved reporter ({ email, external_id }) — object or a function. */
  user?: UserResolver;
  /** Base metadata attached to every report — object or a function. */
  metadata?: MetadataResolver;
  /** Default severity for reports from this surface; also sent as metadata.severity_hint. */
  severity?: string;
  /** Per-surface labels → metadata.labels. */
  labels?: string[];
  /** Extra metadata merged in. */
  extraMetadata?: Record<string, unknown>;
  captureClicks?: boolean;
  captureConsole?: boolean;
  buttonPosition?: ButtonPosition;
  // Test/SSR seams:
  doc?: Document;
  submit?: SubmitFn;
  readFile?: (file: File) => Promise<string>;
  uuid?: () => string;
}

interface StoredFile extends WidgetScreenshot {
  size: number;
  preview: string;
}

function defaultReadFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function defaultUuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// The floating feedback widget. Rebuilds the gem's _widget.html.erb DOM and ports the
// widget.js controller: modal UX, screenshot capture (picker/drag/paste → base64), the
// click-path + console breadcrumbs, and the ticket submit (with Idempotency-Key + widget
// version headers). Separate from the error tracker so you can ship one without the other.
export class Widget {
  private readonly options: WidgetOptions;
  private readonly doc: Document;
  private readonly refs: WidgetRefs;
  private readonly transport: BrowserTransport;
  private readonly submitFn: SubmitFn;
  private readonly readFile: (file: File) => Promise<string>;
  private readonly uuid: () => string;
  private files: StoredFile[] = [];
  private consoleEntries: string[] = [];
  private clickPath: string[] = [];
  private originalConsoleError: typeof console.error | null = null;
  private boundClick: ((event: Event) => void) | null = null;

  constructor(options: WidgetOptions) {
    this.options = options;
    this.doc = options.doc ?? document;
    const config = resolveConfig({
      apiKey: options.apiKey,
      endpoint: options.endpoint,
      errorEndpoint: options.errorEndpoint,
      environment: options.environment,
      release: options.release,
      tags: options.tags,
      sdk: { name: "dispatch-widget", version: WIDGET_VERSION },
    });
    this.transport = new BrowserTransport(config);
    this.submitFn =
      options.submit ?? ((payload, headers) => this.transport.postTicket(payload, { headers }));
    this.readFile = options.readFile ?? defaultReadFile;
    this.uuid = options.uuid ?? defaultUuid;
    this.refs = buildWidgetDom(this.doc, options.buttonPosition ?? "bottom-right");
  }

  mount(): this {
    this.wire();
    this.startCapture();
    (this.doc.body ?? this.doc.documentElement).appendChild(this.refs.root);
    return this;
  }

  unmount(): void {
    this.stopCapture();
    this.refs.root.remove();
  }

  open(): void {
    this.refs.modal.hidden = false;
    this.refs.description.focus();
  }

  close(): void {
    this.refs.modal.hidden = true;
    this.refs.error.style.display = "none";
    this.refs.description.value = "";
    this.files = [];
    this.renderPreviews();
  }

  // Attach screenshots programmatically (also the path the file input / drop / paste use).
  async addFiles(fileList: FileList | File[] | null): Promise<void> {
    if (!fileList) return;
    for (const file of Array.from(fileList)) {
      if (this.files.length >= MAX_SCREENSHOTS) {
        this.showError(`You can attach at most ${MAX_SCREENSHOTS} screenshots.`);
        break;
      }
      if (!SCREENSHOT_TYPES.includes(file.type)) {
        this.showError("Screenshots must be PNG, JPEG, GIF, or WebP images.");
        continue;
      }
      if (file.size > MAX_SCREENSHOT_BYTES) {
        this.showError("Each screenshot must be smaller than 5 MB.");
        continue;
      }
      const name = file.name || "screenshot.png";
      if (this.files.some((f) => f.filename === name && f.size === file.size)) continue;
      const dataUrl = await this.readFile(file);
      this.files.push({
        filename: name,
        content_type: file.type,
        data: dataUrl.split(",")[1] ?? "",
        size: file.size,
        preview: dataUrl,
      });
      this.renderPreviews();
    }
  }

  private wire(): void {
    const r = this.refs;
    r.button.addEventListener("click", () => this.open());
    r.closeButton.addEventListener("click", () => this.close());
    r.cancelButton.addEventListener("click", () => this.close());
    r.attachButton.addEventListener("click", () => r.fileInput.click());
    r.fileInput.addEventListener("change", (event) => {
      const input = event.target as HTMLInputElement;
      void this.addFiles(input.files);
      input.value = ""; // allow re-picking the same file
    });
    r.dropzone.addEventListener("dragover", (event) => {
      event.preventDefault();
      r.dropzone.style.borderColor = "#2563eb";
    });
    r.dropzone.addEventListener("dragleave", () => {
      r.dropzone.style.borderColor = "#1f2937";
    });
    r.dropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      r.dropzone.style.borderColor = "#1f2937";
      const dt = (event as DragEvent).dataTransfer;
      if (dt && dt.files.length) void this.addFiles(dt.files);
    });
    r.dropzone.addEventListener("paste", (event) => this.onPaste(event as ClipboardEvent));
    r.submit.addEventListener("click", () => {
      void this.submit();
    });
  }

  private onPaste(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (!items) return;
    const pasted: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) pasted.push(file);
      }
    }
    if (pasted.length) {
      event.preventDefault();
      void this.addFiles(pasted);
    }
  }

  private startCapture(): void {
    if (this.options.captureConsole) {
      // Keep the raw original (not a bound copy) so unmount restores the exact same reference.
      const original = console.error;
      this.originalConsoleError = original;
      console.error = (...args: unknown[]): void => {
        try {
          this.consoleEntries.push(args.map((a) => String(a)).join(" "));
          if (this.consoleEntries.length > CONSOLE_CAPTURE_MAX) this.consoleEntries.shift();
        } finally {
          original.apply(console, args);
        }
      };
    }
    if (this.options.captureClicks !== false) {
      this.boundClick = (event: Event) => this.trackClick(event);
      this.doc.addEventListener("click", this.boundClick, true);
    }
  }

  private stopCapture(): void {
    if (this.originalConsoleError) {
      console.error = this.originalConsoleError;
      this.originalConsoleError = null;
    }
    if (this.boundClick) {
      this.doc.removeEventListener("click", this.boundClick, true);
      this.boundClick = null;
    }
  }

  // Record the last few non-widget clicks as the user's path to the report.
  private trackClick(event: Event): void {
    const target = event.target;
    const el = target as Element | null;
    if (el && typeof el.closest === "function" && el.closest("[data-dispatch-widget]")) return;
    const label = describeClickTarget(target);
    if (!label) return;
    this.clickPath.push(label);
    if (this.clickPath.length > CLICK_PATH_MAX) this.clickPath.shift();
  }

  private renderPreviews(): void {
    this.refs.attachButton.textContent = `📎 Attach screenshots (${this.files.length}/${MAX_SCREENSHOTS})`;
    this.refs.previews.replaceChildren();
    this.files.forEach((file, index) => {
      const wrapper = this.doc.createElement("div");
      wrapper.style.cssText = STYLES.previewWrapper;
      const img = this.doc.createElement("img");
      img.src = file.preview;
      img.alt = file.filename;
      img.style.cssText = STYLES.previewImg;
      wrapper.appendChild(img);
      const remove = this.doc.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove ${file.filename}`);
      remove.style.cssText = STYLES.previewRemove;
      remove.addEventListener("click", () => {
        this.files.splice(index, 1);
        this.renderPreviews();
      });
      wrapper.appendChild(remove);
      this.refs.previews.appendChild(wrapper);
    });
  }

  private async submit(): Promise<void> {
    const description = this.refs.description.value.trim();
    if (description.length < 5) {
      this.showError("Please add a little more detail (at least 5 characters).");
      return;
    }

    this.refs.submit.disabled = true;
    this.refs.submit.textContent = "Sending…";

    const win = this.doc.defaultView;
    const payload = buildWidgetTicket({
      description,
      severity: this.options.severity ?? null,
      reporter: this.resolveUser(),
      screenshots: this.files.map((f) => ({
        filename: f.filename,
        content_type: f.content_type,
        data: f.data,
      })),
      baseMetadata: { ...this.resolveMetadata(), ...(this.options.extraMetadata ?? {}) },
      labels: this.options.labels,
      severityHint: this.options.severity,
      runtime: {
        url: win?.location?.href,
        userAgent: win?.navigator?.userAgent,
        viewport: win ? `${win.innerWidth}x${win.innerHeight}` : undefined,
        referrer: this.doc.referrer || null,
        consoleErrors: this.consoleEntries.slice(),
        userPath: this.clickPath.slice(),
      },
    });

    try {
      const headers = {
        "Idempotency-Key": this.uuid(),
        "X-Dispatch-Widget-Version": WIDGET_VERSION,
      };
      const result = await this.submitFn(payload, headers);
      if (result === null) throw new Error("submission failed");
      this.close();
      this.showToast();
    } catch {
      this.showError("Something went wrong sending your feedback.");
    } finally {
      this.refs.submit.disabled = false;
      this.refs.submit.textContent = "Send";
    }
  }

  private resolveUser(): Record<string, unknown> | null {
    const u = this.options.user;
    const resolved = typeof u === "function" ? u() : u;
    return resolved ?? null;
  }

  private resolveMetadata(): Record<string, unknown> {
    const m = this.options.metadata;
    return (typeof m === "function" ? m() : m) ?? {};
  }

  private showError(message: string): void {
    this.refs.error.textContent = message;
    this.refs.error.style.display = "block";
  }

  private showToast(): void {
    this.refs.toast.hidden = false;
    setTimeout(() => {
      this.refs.toast.hidden = true;
    }, 3000);
  }
}
