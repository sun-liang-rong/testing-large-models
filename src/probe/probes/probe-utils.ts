import { ProbeEvaluation } from "../probe.types";

export function parseJsonObject(text: string): { ok: true; value: Record<string, unknown> } | { ok: false } {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    const direct = JSON.parse(unfenced);
    return direct && typeof direct === "object" && !Array.isArray(direct)
      ? { ok: true, value: direct as Record<string, unknown> }
      : { ok: false };
  } catch (_) {
    const match = unfenced.match(/\{[\s\S]*\}/);
    if (!match) return { ok: false };
    try {
      const value = JSON.parse(match[0]);
      return value && typeof value === "object" && !Array.isArray(value)
        ? { ok: true, value: value as Record<string, unknown> }
        : { ok: false };
    } catch (_error) {
      return { ok: false };
    }
  }
}

export function scoreFromChecks(checks: Array<[boolean, string]>): ProbeEvaluation {
  const failed = checks.filter(([ok]) => !ok).map(([, note]) => note);
  const score = (checks.length - failed.length) / checks.length;
  return {
    score,
    passed: score >= 0.85,
    note: failed.length ? failed.join("；") : "全部检查通过"
  };
}

export function pass(note: string): ProbeEvaluation {
  return { score: 1, passed: true, note };
}

export function fail(score: number, note: string): ProbeEvaluation {
  return { score, passed: score >= 0.85, note };
}

export function nextPrimes(after: number, count: number) {
  const primes: number[] = [];
  let candidate = after + 1;
  while (primes.length < count) {
    if (isPrime(candidate)) primes.push(candidate);
    candidate += 1;
  }
  return primes;
}

export function isPrime(value: number) {
  if (value < 2) return false;
  for (let divisor = 2; divisor * divisor <= value; divisor += 1) {
    if (value % divisor === 0) return false;
  }
  return true;
}

export function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function token(seed: number, length: number) {
  return (seed >>> 0).toString(16).padStart(length, "0").slice(0, length);
}
