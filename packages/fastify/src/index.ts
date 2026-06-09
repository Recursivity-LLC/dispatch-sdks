// @dispatch/fastify — a Fastify onError hook.
//
// The onError hook OBSERVES errors thrown in the request lifecycle (it does not replace
// Fastify's error handler or change the reply), captures them with handled:false + route
// context, and lets Fastify proceed as usual — the same "capture, don't swallow" shape as the
// gem's Rack middleware.

import {
  type Client,
  type DispatchUser,
  type HttpRequestLike,
  extractRequest,
  getClient,
  normalizeUser,
} from "@dispatch/node";

// Structural subset of a Fastify request — no Fastify types required.
export interface FastifyRequestLike extends HttpRequestLike {
  routeOptions?: { url?: string };
  routerPath?: string;
  user?: unknown;
}

export type OnErrorHook = (
  request: FastifyRequestLike,
  reply: unknown,
  error: unknown,
) => Promise<void>;

export interface DispatchFastifyOptions {
  /** Client to report through. Defaults to the module-level client from init(). */
  client?: Client;
  /** Resolve the affected user from the request. Falls back to request.user. */
  user?: (req: FastifyRequestLike) => DispatchUser | Record<string, unknown> | null | undefined;
  /** Decide whether a given error should be captured. Default: always. */
  shouldHandle?: (err: unknown, req: FastifyRequestLike) => boolean;
}

interface FastifyLike {
  addHook(name: "onError", hook: OnErrorHook): unknown;
}
type Done = (err?: Error) => void;

// "POST /orders/:id" — the route pattern (low cardinality), not the concrete URL.
function transactionOf(req: FastifyRequestLike): string | undefined {
  const url = req.routeOptions?.url ?? req.routerPath;
  if (!url) return req.method;
  return req.method ? `${req.method} ${url}` : url;
}

// The hook factory — use directly via `fastify.addHook("onError", onErrorHook({ ... }))`.
export function onErrorHook(options: DispatchFastifyOptions = {}): OnErrorHook {
  return async (request, _reply, error) => {
    try {
      const client = options.client ?? getClient();
      const handle = options.shouldHandle ? options.shouldHandle(error, request) : true;
      if (!client || !handle) return;
      const resolvedUser = options.user ? options.user(request) : request.user;
      client.captureException(error, {
        handled: false,
        request: extractRequest(request),
        transaction: transactionOf(request),
        user: normalizeUser(resolvedUser),
      });
    } catch {
      // never interfere with Fastify's error flow
    }
  };
}

// Plugin form: `fastify.register(dispatchFastify, { client, user })`. Marked skip-override so the
// hook applies app-wide rather than only within this plugin's encapsulation context.
export function dispatchFastify(
  fastify: FastifyLike,
  options: DispatchFastifyOptions,
  done: Done,
): void {
  fastify.addHook("onError", onErrorHook(options));
  done();
}
(dispatchFastify as unknown as Record<symbol, unknown>)[Symbol.for("skip-override")] = true;
