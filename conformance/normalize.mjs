// Shared normalization for conformance comparisons. Producer tests in every SDK build an
// event from a synthetic exception, run it through normalizeEvent(), and compare to the
// matching golden fixture (also normalized). This strips the genuinely per-run/per-machine
// fields so the comparison asserts the STABLE contract: field names, nesting, ordering,
// in_app flags, mechanism, and limits.
//
// Ports of this helper exist per language (e.g. a Python conftest fixture); keep them in
// lockstep with this list.

const VOLATILE_TOP = ["event_id", "timestamp", "server_name"];

export function normalizeEvent(input) {
  const e = structuredClone(input);
  for (const k of VOLATILE_TOP) if (k in e) e[k] = null;

  for (const val of e.exception?.values ?? []) {
    for (const f of val.stacktrace?.frames ?? []) {
      // abs_path and the literal source lines are machine-specific. Keep their PRESENCE
      // (so a regression that drops source context is still caught) but blank the content.
      if ("abs_path" in f) f.abs_path = null;
      if ("pre_context" in f) f.pre_context = f.pre_context.map(() => "");
      if ("context_line" in f) f.context_line = "";
      if ("post_context" in f) f.post_context = f.post_context.map(() => "");
    }
  }

  for (const b of e.breadcrumbs?.values ?? []) {
    if ("timestamp" in b) b.timestamp = null;
  }
  return e;
}

// Convenience for tests: true when produced matches golden after normalization.
export function eventMatches(produced, golden) {
  return (
    JSON.stringify(normalizeEvent(produced)) === JSON.stringify(normalizeEvent(golden))
  );
}
