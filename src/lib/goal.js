/** Daily goal is stored as whole minutes, from 0 up to 24 hours. */
export const MAX_GOAL_MINUTES = 24 * 60;

export function splitGoal(totalMinutes) {
  const safe = Number.isFinite(totalMinutes) ? Math.max(0, Math.floor(totalMinutes)) : 0;
  return {
    hours: Math.floor(safe / 60),
    minutes: safe % 60,
  };
}

/**
 * Hours are 0–24 and minutes are 0–59. 24:00 is the cap, so 24 hours
 * only pairs with 0 minutes.
 */
export function parseGoal(hoursRaw, minutesRaw) {
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isInteger(hours) || hours < 0 || hours > 24) {
    return { ok: false, error: "Hours go from 0 to 24." };
  }
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    return { ok: false, error: "Minutes go from 0 to 59." };
  }
  if (hours === 24 && minutes !== 0) {
    return { ok: false, error: "24 hours is the maximum, so minutes have to be 0." };
  }
  return { ok: true, minutes: hours * 60 + minutes };
}

export function formatGoal(totalMinutes) {
  const { hours, minutes } = splitGoal(totalMinutes);
  return `${hours}h ${minutes}m`;
}
