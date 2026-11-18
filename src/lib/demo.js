import { addDays, formatDayKey, zonedTime } from "./streak.js";

export const DEMO_TIME_ZONE = "America/New_York";
const GOAL_KEY = "uncooked.goalMinutes";

export function goalFromStorage(raw) {
  if (raw == null || raw === "") return 15;
  const stored = Number(raw);
  if (Number.isInteger(stored) && stored >= 0 && stored <= 24 * 60) return stored;
  return 15;
}

export function loadDemoGoal() {
  if (typeof window === "undefined") return 15;
  return goalFromStorage(localStorage.getItem(GOAL_KEY));
}

export function saveDemoGoal(minutes) {
  localStorage.setItem(GOAL_KEY, String(minutes));
}

export function demoModeFromLocation() {
  if (typeof window === "undefined") return "idle";
  const params = new URLSearchParams(window.location.search);
  return params.get("demo") === "uncooking" ? "uncooking" : "idle";
}

function session(id, start, end) {
  return {
    id,
    started_at: start.toISOString(),
    ended_at: end ? end.toISOString() : null,
  };
}

/**
 * Sample week shaped like the design: six finished days that each beat a
 * 15 minute goal, and today still pending. `?demo=uncooking` adds a live
 * session that has already locked 8 minutes.
 */
export function buildDemo(mode, now = new Date()) {
  const timeZone = DEMO_TIME_ZONE;
  const today = formatDayKey(now, timeZone);
  const sessions = [];

  for (let daysAgo = 6; daysAgo >= 1; daysAgo -= 1) {
    const key = addDays(today, -daysAgo);
    if (daysAgo === 1) {
      sessions.push(
        session(
          `demo-${key}-noon`,
          zonedTime(key, 12, 30, timeZone),
          zonedTime(key, 13, 0, timeZone),
        ),
        session(
          `demo-${key}-night`,
          zonedTime(key, 21, 5, timeZone),
          zonedTime(key, 22, 20, timeZone),
        ),
      );
    } else if (daysAgo === 2) {
      sessions.push(
        session(`demo-${key}`, zonedTime(key, 20, 45, timeZone), zonedTime(key, 21, 30, timeZone)),
      );
    } else if (daysAgo === 3) {
      sessions.push(
        session(`demo-${key}`, zonedTime(key, 19, 10, timeZone), zonedTime(key, 19, 40, timeZone)),
      );
    } else if (daysAgo === 4) {
      sessions.push(
        session(`demo-${key}`, zonedTime(key, 10, 0, timeZone), zonedTime(key, 10, 25, timeZone)),
      );
    } else {
      sessions.push(
        session(`demo-${key}`, zonedTime(key, 18, 0, timeZone), zonedTime(key, 18, 30, timeZone)),
      );
    }
  }

  const uncooking = mode === "uncooking";
  if (uncooking) {
    const started = new Date(now.getTime() - 8 * 60 * 1000);
    sessions.push(session("demo-live", started, null));
  }

  const status = {
    tray_down: uncooking,
    phone_present: uncooking,
    timer_running: uncooking,
    remaining_ms: uncooking ? (42 * 60 + 15) * 1000 : 0,
    updated_at: now.toISOString(),
  };

  return { sessions, status, timeZone };
}
