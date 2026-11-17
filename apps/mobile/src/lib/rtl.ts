/**
 * Pure helper: after forceRTL(true), Android/iOS often keep layout LTR until
 * a process reload. Reload once when the runtime still reports !isRTL.
 */
export function shouldReloadForRtl(isRtlNow: boolean, alreadyReloaded: boolean): boolean {
  return !isRtlNow && !alreadyReloaded;
}
