// Breadcrumbs: a small ring buffer of recent UI/console events that gives an error its
// lead-up context, plus the "user path" (the last few clicks). Ported from error_tracker.js.

export interface Breadcrumb {
  timestamp: number;
  category: string;
  level: string;
  message: string;
}

export const MAX_BREADCRUMBS = 30;
export const USER_PATH_LIMIT = 5;

export class BreadcrumbBuffer {
  private crumbs: Breadcrumb[] = [];

  constructor(private readonly max: number = MAX_BREADCRUMBS) {}

  add(crumb: Breadcrumb): void {
    this.crumbs.push(crumb);
    if (this.crumbs.length > this.max) this.crumbs.shift();
  }

  snapshot(): Breadcrumb[] {
    return this.crumbs.slice();
  }

  // The last few click labels, oldest→newest — a concise path to the error.
  userPath(limit: number = USER_PATH_LIMIT): string[] {
    return this.crumbs
      .filter((c) => c.category === "ui.click")
      .slice(-limit)
      .map((c) => c.message);
  }

  clear(): void {
    this.crumbs = [];
  }
}

// A short, human-readable label for a clicked element. Walks up to the nearest interactive
// ancestor, then prefers visible text, then an a11y/name attribute, then id/class.
export function describeClickTarget(node: unknown): string | null {
  const start = node && (node as { nodeType?: number }).nodeType === 1 ? (node as Element) : null;
  if (!start) return null;

  let el: Element = start;
  if (typeof start.closest === "function") {
    el =
      start.closest(
        "button, a, input, select, textarea, label, [role='button'], [role='link'], [data-action]",
      ) || start;
  }

  const tag = (el.tagName || "").toLowerCase();
  const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
  const attr =
    el.getAttribute?.("aria-label") ||
    el.getAttribute?.("title") ||
    el.getAttribute?.("name") ||
    el.getAttribute?.("placeholder");
  const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : "";

  const label = text || attr;
  if (label) return `${tag}${id} "${label}"`.slice(0, 80);

  const className = (el as HTMLElement).className;
  const cls =
    typeof className === "string" && className.trim()
      ? `.${className.trim().split(/\s+/)[0]}`
      : "";
  return `${tag}${id}${cls}`.slice(0, 80) || tag || null;
}
