import assert from "node:assert/strict";
import test from "node:test";
import { goalFromStorage } from "../src/lib/demo.js";
import { formatGoal, parseGoal, splitGoal } from "../src/lib/goal.js";

test("default goal splits to 0 hours and 15 minutes", () => {
  assert.deepEqual(splitGoal(15), { hours: 0, minutes: 15 });
  assert.equal(formatGoal(15), "0h 15m");
});

test("a missing saved goal stays at the 15 minute default", () => {
  assert.equal(goalFromStorage(null), 15);
  assert.equal(goalFromStorage(""), 15);
  assert.equal(goalFromStorage("0"), 0);
  assert.equal(goalFromStorage("90"), 90);
  assert.equal(goalFromStorage("nope"), 15);
});

test("parseGoal accepts a full day and rejects an extra minute", () => {
  assert.deepEqual(parseGoal(24, 0), { ok: true, minutes: 1440 });
  assert.equal(parseGoal(24, 1).ok, false);
  assert.equal(parseGoal(2, 60).ok, false);
  assert.equal(parseGoal(-1, 0).ok, false);
  assert.deepEqual(parseGoal(1, 30), { ok: true, minutes: 90 });
});
