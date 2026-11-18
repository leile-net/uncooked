/** A report older than this is treated as "the toaster went quiet". */
export const STALE_MS = 20_000;

/**
 * Uncooking means the phone is locked away: both sensor pairs see
 * something (tray down and phone in the tray) and the device timer is running.
 * Either sensor missing, or a stopped timer, is "not uncooking".
 */
export function isUncooking(status) {
  return Boolean(status?.tray_down && status?.phone_present && status?.timer_running);
}

export function isFresh(status, now) {
  if (!status?.updated_at) return false;
  const age = now.getTime() - new Date(status.updated_at).getTime();
  return age >= 0 && age < STALE_MS;
}

export function freshUncooking(status, now) {
  return isUncooking(status) && isFresh(status, now);
}

/** Countdown shown on the page, catching up between Arduino reports. */
export function displayRemainingMs(status, now) {
  if (!freshUncooking(status, now)) return 0;
  const elapsed = now.getTime() - new Date(status.updated_at).getTime();
  return Math.max(0, status.remaining_ms - elapsed);
}

export function sessionIsOpen(session, status, now) {
  return !session.ended_at && freshUncooking(status, now);
}

/**
 * When the toaster stops reporting mid-session, stop the clock at the
 * last report instead of letting an open row count forever.
 */
export function sessionEndMs(session, status, now) {
  if (session.ended_at) return new Date(session.ended_at).getTime();
  if (freshUncooking(status, now)) return now.getTime();
  if (status?.updated_at) return new Date(status.updated_at).getTime();
  return new Date(session.started_at).getTime();
}
