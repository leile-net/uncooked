import assert from "node:assert/strict";
import test from "node:test";
import { buildDemo } from "../src/lib/demo.js";
import { formatRemaining } from "../src/lib/format.js";
import { addDays, buildStreak, formatDayKey, historyRows, minutesByDay, zonedTime } from "../src/lib/streak.js";

const timeZone = "America/New_York";
const now = new Date("2026-11-18T23:18:00.000Z");

test("demo week matches the design: six days, today still pending", () => {
  const demo = buildDemo("idle", now);
  const streak = buildStreak({
    sessions: demo.sessions,
    status: demo.status,
    goalMinutes: 15,
    timeZone,
    now,
  });
  assert.equal(formatDayKey(now, timeZone), "2026-11-18");
  assert.equal(streak.count, 6);
  assert.equal(streak.todayMinutes, 0);
  assert.deepEqual(
    streak.days.map((day) => day.label),
    ["T", "F", "S", "S", "M", "T", "Today"],
  );
  assert.deepEqual(
    streak.days.map((day) => day.status),
    ["met", "met", "met", "met", "met", "met", "pending"],
  );
});

test("a live session counts toward today but not toward the streak yet", () => {
  const demo = buildDemo("uncooking", now);
  const streak = buildStreak({
    sessions: demo.sessions,
    status: demo.status,
    goalMinutes: 15,
    timeZone,
    now,
  });
  assert.equal(streak.count, 6);
  assert.equal(Math.floor(streak.todayMinutes), 8);
  const rows = historyRows(demo.sessions, demo.status, now);
  assert.equal(rows[0].inProgress, true);
  assert.equal(formatRemaining(demo.status.remaining_ms), "00:42:15");
});

test("missing yesterday breaks the streak even if older days were met", () => {
  const demo = buildDemo("idle", now);
  const yesterday = addDays(formatDayKey(now, timeZone), -1);
  const sessions = demo.sessions.filter((session) => !session.id.includes(yesterday));
  const streak = buildStreak({
    sessions,
    status: demo.status,
    goalMinutes: 15,
    timeZone,
    now,
  });
  assert.equal(streak.count, 0);
  assert.equal(streak.days.at(-2).status, "missed");
});

test("a session that crosses midnight is split across the two local days", () => {
  const start = zonedTime("2026-11-17", 23, 30, timeZone);
  const end = zonedTime("2026-11-18", 0, 30, timeZone);
  const totals = minutesByDay(
    [{ id: "cross", started_at: start.toISOString(), ended_at: end.toISOString() }],
    null,
    timeZone,
    now,
  );
  assert.equal(totals.get("2026-11-17"), 30);
  assert.equal(totals.get("2026-11-18"), 30);
});

test("a quiet toaster does not keep an open session counting", () => {
  const started = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const status = {
    tray_down: true,
    phone_present: true,
    timer_running: true,
    remaining_ms: 0,
    updated_at: new Date(now.getTime() - 60_000).toISOString(),
  };
  const sessions = [{ id: "stuck", started_at: started.toISOString(), ended_at: null }];
  const totals = minutesByDay(sessions, status, timeZone, now);
  const today = formatDayKey(now, timeZone);
  assert.ok(totals.get(today) < 120);
  assert.equal(Math.round(totals.get(today)), 119);
  const rows = historyRows(sessions, status, now);
  assert.equal(rows[0].inProgress, false);
});
