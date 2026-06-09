// Inline styles ported verbatim from the gem's _widget.html.erb, so the npm widget renders
// identically with no external stylesheet (a hard requirement for a drop-in widget).

export type ButtonPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";

export function buttonStyle(position: ButtonPosition): string {
  const vertical = position.includes("bottom") ? "bottom:24px" : "top:24px";
  const horizontal = position.includes("right") ? "right:24px" : "left:24px";
  return (
    `position:fixed;${vertical};${horizontal};width:56px;height:56px;border-radius:9999px;` +
    "background:#2563eb;color:#fff;border:none;box-shadow:0 8px 24px rgba(37,99,235,0.35);" +
    "cursor:pointer;font-size:24px;display:flex;align-items:center;justify-content:center;z-index:9999;"
  );
}

export const STYLES = {
  modal:
    "position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;" +
    "justify-content:center;z-index:10000;",
  card:
    "background:#0a0a0a;color:#e5e7eb;border:1px solid #1f2937;border-radius:12px;padding:24px;" +
    "width:min(480px,calc(100% - 32px));font-family:ui-sans-serif,system-ui,sans-serif;",
  header: "display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;",
  h2: "font-family:ui-monospace,monospace;letter-spacing:0.05em;color:#60a5fa;margin:0;",
  closeX: "background:none;border:none;color:#9ca3af;font-size:20px;cursor:pointer;",
  hint: "font-size:13px;color:#9ca3af;margin:0 0 12px;",
  textarea:
    "width:100%;background:#0a0a0a;color:#e5e7eb;border:1px solid #1f2937;border-radius:6px;" +
    "padding:10px;font-family:ui-monospace,monospace;font-size:13px;box-sizing:border-box;",
  attachRow: "display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap;",
  attachButton:
    "padding:6px 12px;background:#1f2937;border:1px solid #374151;color:#e5e7eb;border-radius:6px;" +
    "cursor:pointer;font-family:ui-monospace,monospace;font-size:12px;",
  attachHint: "font-size:11px;color:#6b7280;",
  previews: "display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;",
  error: "color:#f87171;font-size:12px;margin-top:8px;display:none;",
  footer: "display:flex;gap:8px;justify-content:flex-end;margin-top:16px;",
  cancelButton:
    "padding:8px 14px;background:#1f2937;border:1px solid #374151;color:#e5e7eb;border-radius:6px;" +
    "cursor:pointer;font-family:ui-monospace,monospace;font-size:13px;",
  reportButton:
    "padding:8px 14px;background:#2563eb;border:none;color:#fff;border-radius:6px;cursor:pointer;" +
    "font-family:ui-monospace,monospace;font-size:13px;",
  toast:
    "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#064e3b;" +
    "color:#a7f3d0;border:1px solid #34d399;border-radius:6px;padding:10px 16px;" +
    "font-family:ui-monospace,monospace;font-size:13px;z-index:10001;box-shadow:0 8px 24px rgba(0,0,0,0.4);",
  previewWrapper:
    "position:relative;width:64px;height:64px;border:1px solid #1f2937;border-radius:6px;" +
    "overflow:hidden;background:#0a0a0a;",
  previewImg: "width:100%;height:100%;object-fit:cover;",
  previewRemove:
    "position:absolute;top:2px;right:2px;width:18px;height:18px;line-height:16px;padding:0;" +
    "background:rgba(0,0,0,0.7);color:#fff;border:none;border-radius:9999px;cursor:pointer;font-size:13px;",
} as const;
