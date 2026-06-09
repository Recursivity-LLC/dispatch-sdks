import type { DispatchFrame } from "./types";

export const MAX_FRAMES = 100;

// Frames the parser should treat as the app's own code. Excludes dependencies and runtime
// internals; mirrors the gem's in_app heuristic, adapted to JS runtimes.
function isInApp(file: string): boolean {
  if (!file) return false;
  if (file.includes("node_modules")) return false;
  if (file.startsWith("node:") || file.startsWith("internal/")) return false;
  return true;
}

// Portable best-effort stack parser. Handles the two dominant formats:
//   V8 (Chrome/Node):  "    at fn (file:line:col)"  /  "    at file:line:col"
//   SpiderMonkey/JSC:  "fn@file:line:col"            /  "@file:line:col"
// Returns frames OLDEST FIRST (the failing frame last), matching the contract. Lines that
// don't look like frames (e.g. the leading "TypeError: ..." message) are skipped.
//
// This is the minimal core parser used by manual capture. The browser SDK ships a more
// thorough parser (source maps, eval frames); server SDKs add source context on top.
export function parseStack(stack?: string | null): DispatchFrame[] {
  if (!stack) return [];
  const frames: DispatchFrame[] = [];

  for (const raw of stack.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    const v8WithFn = /^at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)$/.exec(line);
    const v8NoFn = v8WithFn ? null : /^at\s+(.+?):(\d+):(\d+)$/.exec(line);
    const mozilla = v8WithFn || v8NoFn ? null : /^(.*?)@(.+?):(\d+):(\d+)$/.exec(line);

    let fn: string;
    let file: string;
    let lineno: number;
    let colno: number;

    if (v8WithFn) {
      fn = v8WithFn[1]!;
      file = v8WithFn[2]!;
      lineno = Number(v8WithFn[3]);
      colno = Number(v8WithFn[4]);
    } else if (v8NoFn) {
      fn = "?";
      file = v8NoFn[1]!;
      lineno = Number(v8NoFn[2]);
      colno = Number(v8NoFn[3]);
    } else if (mozilla) {
      fn = mozilla[1] || "?";
      file = mozilla[2]!;
      lineno = Number(mozilla[3]);
      colno = Number(mozilla[4]);
    } else {
      continue;
    }

    frames.push({
      function: fn,
      filename: file,
      abs_path: file,
      lineno,
      colno,
      in_app: isInApp(file),
    });
  }

  // Stack is newest-first; cap then reverse to oldest-first (failing frame last).
  return frames.slice(0, MAX_FRAMES).reverse();
}
