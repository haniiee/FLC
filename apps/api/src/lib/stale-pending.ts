const ONE_HOUR_MS = 60 * 60 * 1000;

/** True when a pending file's createdAt is older than one hour before `now`. */
export function isStalePending(createdAt: Date, now: Date = new Date()): boolean {
  if (!(createdAt instanceof Date) || Number.isNaN(createdAt.getTime())) return false;
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return false;
  return now.getTime() - createdAt.getTime() >= ONE_HOUR_MS;
}

export const STALE_PENDING_MS = ONE_HOUR_MS;
