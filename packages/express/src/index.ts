// @dispatchitapp/express — Express error-handler middleware.
//
// Register it LAST (after your routes and any other error handlers) so it sees unhandled route
// errors with full request context, captures them (handled:false), and then re-propagates via
// next(err) — it never swallows the error. The innermost-and-re-raise shape mirrors the gem's
// Rack middleware.

import {
  type Client,
  type DispatchUser,
  type HttpRequestLike,
  extractRequest,
  getClient,
  normalizeUser,
} from "@dispatchitapp/node";

// Structural subset of an Express request — we depend on no Express types.
export interface ExpressRequestLike extends HttpRequestLike {
  baseUrl?: string;
  path?: string;
  route?: { path?: string };
  user?: unknown;
}

type NextFunction = (err?: unknown) => void;

export interface ErrorHandlerOptions {
  /** Client to report through. Defaults to the module-level client from init(). */
  client?: Client;
  /** Resolve the affected user from the request. Falls back to req.user. */
  user?: (req: ExpressRequestLike) => DispatchUser | Record<string, unknown> | null | undefined;
  /** Decide whether a given error should be captured. Default: always. */
  shouldHandle?: (err: unknown, req: ExpressRequestLike) => boolean;
}

// "POST /orders/:id" — prefer the matched route pattern (low cardinality), else the path.
function transactionOf(req: ExpressRequestLike): string | undefined {
  const routePath = req.route?.path;
  const base = req.baseUrl ?? "";
  const path = routePath ? base + routePath : (req.path ?? req.originalUrl ?? req.url);
  if (!path) return undefined;
  return req.method ? `${req.method} ${path}` : path;
}

export function errorHandler(options: ErrorHandlerOptions = {}) {
  // Arity 4 is required for Express to treat this as an error handler.
  return function dispatchErrorHandler(
    err: unknown,
    req: ExpressRequestLike,
    _res: unknown,
    next: NextFunction,
  ): void {
    try {
      const client = options.client ?? getClient();
      const handle = options.shouldHandle ? options.shouldHandle(err, req) : true;
      if (client && handle) {
        const resolvedUser = options.user ? options.user(req) : req.user;
        client.captureException(err, {
          handled: false,
          request: extractRequest(req),
          transaction: transactionOf(req),
          user: normalizeUser(resolvedUser),
        });
      }
    } catch {
      // Telemetry must never break the error pipeline.
    }
    next(err);
  };
}
