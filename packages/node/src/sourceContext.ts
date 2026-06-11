import { readFileSync } from "node:fs";
import type { DispatchFrame } from "@dispatchitapp/core";

export const CONTEXT_LINES = 5;
export const MAX_CONTEXT_FRAMES = 12;

// Cache file contents per path for the process lifetime — a single request's stack often
// revisits the same file, and source doesn't change under a running process.
const sourceCache = new Map<string, string[] | null>();

function rstrip(line: string): string {
  return line.replace(/\s+$/, "");
}

function sourceLines(path: string): string[] | null {
  const cached = sourceCache.get(path);
  if (cached !== undefined) return cached;
  let lines: string[] | null = null;
  try {
    lines = readFileSync(path, "utf8").split("\n");
  } catch {
    lines = null;
  }
  sourceCache.set(path, lines);
  return lines;
}

function applyContext(frame: DispatchFrame): void {
  const path = frame.abs_path;
  const lineno = frame.lineno;
  if (!path || !lineno) return;
  const lines = sourceLines(path);
  if (!lines) return;
  const idx = lineno - 1;
  if (idx < 0 || idx >= lines.length) return;
  frame.pre_context = lines.slice(Math.max(0, idx - CONTEXT_LINES), idx).map(rstrip);
  frame.context_line = rstrip(lines[idx]!);
  frame.post_context = lines.slice(idx + 1, idx + 1 + CONTEXT_LINES).map(rstrip);
}

// Add source context to the most-recent in-app frames (the tail of the oldest-first array),
// within a per-event budget. Mirrors EventBuilder#annotate_context.
export function addSourceContext(frames: DispatchFrame[]): void {
  let budget = MAX_CONTEXT_FRAMES;
  for (let i = frames.length - 1; i >= 0 && budget > 0; i--) {
    const frame = frames[i]!;
    if (!frame.in_app) continue;
    budget--;
    applyContext(frame);
  }
}

// Exposed for tests so a fixture file's freshly-written contents aren't masked by the cache.
export function clearSourceCache(): void {
  sourceCache.clear();
}
