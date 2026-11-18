import { sessionEndMs, sessionIsOpen } from "./status.js";

const WEEKDAY_LETTER = {
  Sun: "S",
  Mon: "M",
  Tue: "T",
  Wed: "W",
  Thu: "T",
  Fri: "F",
  Sat: "S",
};

/** Offset of `timeZone` at `date`: local = utc + offset. */
export function timeZoneOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - date.getTime();
}

export function formatDayKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return `${map.year}-${map.month}-${map.day}`;
}

export function addDays(dayKey, days) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Midnight at the start of `dayKey` in `timeZone`. */
export function startOfZonedDay(dayKey, timeZone) {
  const [year, month, day] = dayKey.split("-").map(Number);
  let utc = Date.UTC(year, month - 1, day, 0, 0, 0);
  for (let i = 0; i < 4; i += 1) {
    const next = Date.UTC(year, month - 1, day, 0, 0, 0) - timeZoneOffsetMs(new Date(utc), timeZone);
    if (next === utc) break;
    utc = next;
  }
  return new Date(utc);
}

/** A wall-clock time on `dayKey` in `timeZone`, as a UTC Date. */
export function zonedTime(dayKey, hour, minute, timeZone) {
  const [year, month, day] = dayKey.split("-").map(Number);
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 4; i += 1) {
    const next = Date.UTC(year, month - 1, day, hour, minute, 0) - timeZoneOffsetMs(new Date(utc), timeZone);
    if (next === utc) break;
    utc = next;
  }
  return new Date(utc);
}

export function weekdayLetter(date, timeZone) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  return WEEKDAY_LETTER[name] ?? name.slice(0, 1);
}

function dayMet(minutes, goalMinutes) {
  if (goalMinutes <= 0) return minutes > 0;
  return minutes + 1e-6 >= goalMinutes;
}

/**
 * Locked minutes per local calendar day. Sessions that cross midnight
 * are split. Open sessions count up to now only while the toaster is
 * still reporting an active lock.
 */
export function minutesByDay(sessions, status, timeZone, now) {
  const totals = new Map();
  for (const session of sessions) {
    const startMs = new Date(session.started_at).getTime();
    const endMs = sessionEndMs(session, status, now);
    if (!(endMs > startMs)) continue;
    let day = formatDayKey(new Date(startMs), timeZone);
    const lastDay = formatDayKey(new Date(endMs - 1), timeZone);
    for (let i = 0; i < 4000; i += 1) {
      const dayStart = startOfZonedDay(day, timeZone).getTime();
      const nextStart = startOfZonedDay(addDays(day, 1), timeZone).getTime();
      const overlap = Math.min(endMs, nextStart) - Math.max(startMs, dayStart);
      if (overlap > 0) totals.set(day, (totals.get(day) ?? 0) + overlap / 60000);
      if (day === lastDay) break;
      day = addDays(day, 1);
    }
  }
  return totals;
}

/**
 * A finished day counts when locked minutes >= the daily goal.
 * Today stays pending until midnight, so the streak ends at yesterday.
 * A 0-minute goal only counts a day the toaster was actually used.
 */
export function buildStreak({ sessions, status, goalMinutes, timeZone, now }) {
  const totals = minutesByDay(sessions, status, timeZone, now);
  const today = formatDayKey(now, timeZone);
  let count = 0;
  let cursor = addDays(today, -1);
  for (let i = 0; i < 3660; i += 1) {
    const minutes = totals.get(cursor) ?? 0;
    if (!dayMet(minutes, goalMinutes)) break;
    count += 1;
    cursor = addDays(cursor, -1);
  }

  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const key = addDays(today, -i);
    const minutes = totals.get(key) ?? 0;
    const isToday = i === 0;
    days.push({
      key,
      label: isToday ? "Today" : weekdayLetter(startOfZonedDay(key, timeZone), timeZone),
      minutes,
      status: isToday ? "pending" : dayMet(minutes, goalMinutes) ? "met" : "missed",
    });
  }

  return {
    count,
    days,
    todayMinutes: totals.get(today) ?? 0,
  };
}

export function historyRows(sessions, status, now) {
  return [...sessions]
    .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
    .map((session) => {
      const inProgress = sessionIsOpen(session, status, now);
      return {
        id: session.id,
        startedAt: session.started_at,
        endedAt: inProgress ? null : new Date(sessionEndMs(session, status, now)).toISOString(),
        inProgress,
      };
    });
}
