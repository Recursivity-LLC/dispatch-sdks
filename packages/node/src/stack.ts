import { isAbsolute, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseStack as coreParseStack, type DispatchFrame } from "@dispatch/core";
import { addSourceContext } from "./sourceContext";

function underRoot(absPath: string, root: string): boolean {
  return absPath === root || absPath.startsWith(root + sep);
}

// A parseStack tailored to a Node server: starts from core's portable V8 parse, then resolves
// file:// URLs, recomputes in_app/filename against the project root, and reads source context
// for in-app frames. Mirrors the gem's EventBuilder frame handling (relative filename, in_app,
// pre/context/post). Pass the result as the Client's `parseStack`.
export function nodeStackParser(cwd: string): (stack?: string | null) => DispatchFrame[] {
  return (stack?: string | null): DispatchFrame[] => {
    const frames = coreParseStack(stack);

    for (const frame of frames) {
      let abs = frame.abs_path ?? null;
      if (abs && abs.startsWith("file://")) {
        try {
          abs = fileURLToPath(abs);
        } catch {
          /* keep the original */
        }
        frame.abs_path = abs;
      }

      if (abs && isAbsolute(abs) && !abs.includes("node_modules") && underRoot(abs, cwd)) {
        frame.in_app = true;
        frame.filename = relative(cwd, abs);
      } else {
        // node: internals, dependencies, or paths outside the project are not app code.
        frame.in_app = false;
      }
    }

    addSourceContext(frames);
    return frames;
  };
}
