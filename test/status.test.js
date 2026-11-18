import assert from "node:assert/strict";
import test from "node:test";
import { displayRemainingMs, freshUncooking, isUncooking } from "../src/lib/status.js";

const now = new Date("2026-11-18T23:18:00.000Z");

test("uncooking requires both sensors and a running timer", () => {
  assert.equal(isUncooking({ tray_down: true, phone_present: true, timer_running: true }), true);
  assert.equal(isUncooking({ tray_down: true, phone_present: true, timer_running: false }), false);
  assert.equal(isUncooking({ tray_down: false, phone_present: true, timer_running: true }), false);
  assert.equal(isUncooking({ tray_down: true, phone_present: false, timer_running: true }), false);
  assert.equal(isUncooking(null), false);
});

test("countdown follows the last report and stops when the report is stale", () => {
  const status = {
    tray_down: true,
    phone_present: true,
    timer_running: true,
    remaining_ms: 42 * 60 * 1000 + 15 * 1000,
    updated_at: new Date(now.getTime() - 5000).toISOString(),
  };
  assert.equal(freshUncooking(status, now), true);
  assert.equal(displayRemainingMs(status, now), 42 * 60 * 1000 + 10 * 1000);

  const stale = { ...status, updated_at: new Date(now.getTime() - 30_000).toISOString() };
  assert.equal(freshUncooking(stale, now), false);
  assert.equal(displayRemainingMs(stale, now), 0);
});
