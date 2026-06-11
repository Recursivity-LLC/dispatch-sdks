import type { DispatchFrame } from "@dispatchitapp/core";

export const MAX_FRAMES = 100;

// Browser in_app: the app's own http(s) code, not a dependency.
function isInApp(url: string): boolean {
  return /^https?:\/\//.test(url) && !url.includes("node_modules");
}

// V8 (Chrome/Edge/Node-in-browser): "    at fn (url:line:col)"
const CHROME_FN = /^\s*at (?:async )?(.+?) \((.+?):(\d+):(\d+)\)\s*$/;
// V8 bare frame: "    at url:line:col"  (top-level / anonymous)
const CHROME_BARE = /^\s*at (?:async )?(.+?):(\d+):(\d+)\s*$/;
// SpiderMonkey / JavaScriptCore: "fn@url:line:col" or "@url:line:col"
const MOZ = /^(.*?)@(.+?):(\d+):(\d+)\s*$/;

function frame(fn: string, url: string, line: string, col: string): DispatchFrame {
  return {
    function: fn || "?",
    filename: url,
    abs_path: url,
    lineno: Number(line),
    colno: Number(col),
    in_app: isInApp(url),
  };
}

// Parse a browser error stack across the dominant engines. Returns frames OLDEST FIRST (the
// failing frame last), matching the contract. Non-frame lines (e.g. the leading message) are
// skipped. A real replacement for error_tracker.js's 3-regex best-effort: it keeps column
// numbers and handles `async`/anonymous/global frames.
export function parseStack(stack?: string | null): DispatchFrame[] {
  if (!stack) return [];
  const frames: DispatchFrame[] = [];

  for (const raw of stack.split("\n")) {
    const line = raw.trimEnd();
    if (!line) continue;

    let m = CHROME_FN.exec(line);
    if (m) {
      frames.push(frame(m[1]!, m[2]!, m[3]!, m[4]!));
      continue;
    }
    m = CHROME_BARE.exec(line);
    if (m) {
      frames.push(frame("?", m[1]!, m[2]!, m[3]!));
      continue;
    }
    m = MOZ.exec(line);
    if (m) {
      frames.push(frame(m[1] || "?", m[2]!, m[3]!, m[4]!));
      continue;
    }
  }

  // Stack is newest-first; cap then reverse to oldest-first.
  return frames.slice(0, MAX_FRAMES).reverse();
}
