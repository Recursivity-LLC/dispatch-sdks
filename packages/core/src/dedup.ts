// Prevents the same error object from being reported twice (e.g. once by a framework error
// handler and again by a global handler after re-raise). The gem sets an instance variable on
// the exception; JS can't add hidden props safely across realms, so we track identity in a
// WeakSet — entries are GC'd with the error, so this never leaks.
const captured = new WeakSet<object>();

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

export function alreadyCaptured(error: unknown): boolean {
  return isObject(error) && captured.has(error);
}

export function markCaptured(error: unknown): void {
  if (isObject(error)) captured.add(error);
}
