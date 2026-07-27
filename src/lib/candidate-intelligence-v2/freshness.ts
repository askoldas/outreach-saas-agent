import type { FreshnessClass, FreshnessState } from "./contracts.ts";

const FRESHNESS_WINDOWS_DAYS: Record<
  FreshnessClass,
  { current: number; acceptable: number }
> = {
  stable: { current: 730, acceptable: 3650 },
  slow_changing: { current: 180, acceptable: 730 },
  dynamic: { current: 45, acceptable: 180 },
  volatile: { current: 14, acceptable: 45 },
};

export function classifyFreshness(
  freshnessClass: FreshnessClass,
  observedAt: string | undefined,
  now: Date = new Date(),
): FreshnessState {
  if (!observedAt) return "unknown";
  const observed = new Date(observedAt);
  if (Number.isNaN(observed.getTime()) || observed > now) return "unknown";
  const ageDays = (now.getTime() - observed.getTime()) / 86_400_000;
  const window = FRESHNESS_WINDOWS_DAYS[freshnessClass];
  if (ageDays <= window.current) return "current";
  if (ageDays <= window.acceptable) return "acceptable";
  return "stale";
}

export function shouldReuseEvidence(input: {
  freshnessClass: FreshnessClass;
  observedAt?: string;
  minimumState: "current" | "acceptable";
  accessStatus: "available" | "blocked" | "removed" | "partial";
  now?: Date;
}): boolean {
  if (input.accessStatus !== "available") return false;
  const state = classifyFreshness(input.freshnessClass, input.observedAt, input.now);
  return input.minimumState === "current"
    ? state === "current"
    : state === "current" || state === "acceptable";
}
