// @dispatchitapp/node — the Node.js server SDK.
//
// Adds, on top of @dispatchitapp/core: V8 stack frames with source context (the gem's in-app
// `pre/context/post_context`), and process-level global error handlers — the runtime-level
// analogue of the gem's Rack middleware + Rails.error subscriber. Framework middleware
// (Express/Fastify) builds on this in @dispatchitapp/express / @dispatchitapp/fastify.

import { type Client, type ClientOptions, init as coreInit } from "@dispatchitapp/core";
import { type GlobalHandlerOptions, installGlobalHandlers } from "./handlers";
import { nodeStackParser } from "./stack";
import { SDK_NAME, SDK_VERSION } from "./version";

export interface NodeOptions extends ClientOptions, GlobalHandlerOptions {
  /** Project root for in_app detection + relative filenames. Default process.cwd(). */
  cwd?: string;
  /** Install process-level uncaught/unhandledRejection handlers. Default true. */
  installGlobalHandlers?: boolean;
}

// Initialise the default Node client: a "node" platform, the dispatch-node SDK identity, the
// source-context stack parser, and (by default) global handlers. Returns the client.
export function init(options: NodeOptions): Client {
  const cwd = options.cwd ?? process.cwd();
  const client = coreInit({
    ...options,
    platform: options.platform ?? "node",
    sdk: options.sdk ?? { name: SDK_NAME, version: SDK_VERSION },
    parseStack: options.parseStack ?? nodeStackParser(cwd),
  });

  if (options.installGlobalHandlers !== false) {
    installGlobalHandlers(client, options);
  }
  return client;
}

// Node-specific exports.
export { nodeStackParser } from "./stack";
export { addSourceContext, clearSourceCache, CONTEXT_LINES, MAX_CONTEXT_FRAMES } from "./sourceContext";
export { installGlobalHandlers } from "./handlers";
export type { GlobalHandlerOptions, ProcessLike } from "./handlers";
export { extractRequest, normalizeUser } from "./request";
export type { HttpRequestLike } from "./request";
export { SDK_NAME, SDK_VERSION } from "./version";

// Re-export the core runtime API so consumers import everything from @dispatchitapp/node.
export {
  Client,
  captureException,
  report,
  flush,
  close,
  getClient,
  buildEvent,
  buildTicketPayload,
  parseStack,
  resolveConfig,
} from "@dispatchitapp/core";
export type {
  CaptureContext,
  ClientOptions,
  DispatchOptions,
  DispatchConfig,
  DispatchEvent,
  DispatchExceptionValue,
  DispatchFrame,
  DispatchUser,
  DispatchRequest,
  Level,
  ReportInput,
  Tags,
  TicketPayload,
  TicketResponse,
  Transport,
} from "@dispatchitapp/core";
