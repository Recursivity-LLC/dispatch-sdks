// Client-side error sampling. Mirrors Reporter#sampled_out?: a rate >= 1 keeps everything,
// <= 0 drops everything, otherwise keep with probability `rate`. The rng is injectable so
// tests are deterministic.
export function sampledOut(rate: number, rng: () => number = Math.random): boolean {
  if (rate >= 1) return false;
  if (rate <= 0) return true;
  return rng() > rate;
}
