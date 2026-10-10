export const CLICKUP_LIMIT_PER_MINUTE = 100;
export const CLICKUP_BUDGET_PER_MINUTE = 90;
const WINDOW_MS = 60_000;
const RESET_GRACE_MS = 250;
const MAX_WAIT_MS = 90_000;
const FALLBACK_WAIT_MS = 60_000;

export function rateLimitDelayMs(
  resetHeader: string | null,
  nowMs: number,
): number {
  if (resetHeader === null || resetHeader.trim() === "") {
    return FALLBACK_WAIT_MS;
  }
  const raw = Number(resetHeader.trim());
  if (!Number.isFinite(raw) || raw <= 0) return FALLBACK_WAIT_MS;
  const resetMs = raw > 1e12 ? raw : raw * 1000;
  const wait = resetMs - nowMs + RESET_GRACE_MS;
  if (wait <= 0) return 0;
  return Math.min(wait, MAX_WAIT_MS);
}

export function throttleDelayMs(
  timestamps: readonly number[],
  nowMs: number,
  budget = CLICKUP_BUDGET_PER_MINUTE,
): number {
  const recent = timestamps.filter((stamp) => stamp > nowMs - WINDOW_MS).sort((
    a,
    b,
  ) => a - b);
  if (recent.length < budget) return 0;
  const oldest = recent[0];
  if (oldest === undefined) return 0;
  return Math.max(0, oldest + WINDOW_MS - nowMs + 50);
}
