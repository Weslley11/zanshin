import { test } from "node:test";
import assert from "node:assert/strict";
import { activityHref, formatMinutes } from "../activities.ts";

const base = { id: "d3-a1", title_pt: "x", minutes: 10, skills: [], done: false };

test("conversation activity opens the tutor with the challenge length", () => {
  const h = activityHref({ ...base, type: "conversation", params: { challenge_minutes: 10, mode: "natural" } }, 3);
  assert.equal(h.pathname, "/tutor/new");
  assert.deepEqual(h.params, { planDay: "3", planActivity: "d3-a1", mode: "challenge", minutes: "10" });
});

test("no_native conversation keeps the mode", () => {
  const h = activityHref({ ...base, type: "conversation", params: { challenge_minutes: 5, mode: "no_native" } }, 1);
  assert.equal(h.params.mode, "no_native");
});

test("scenario and listening carry their ids", () => {
  assert.equal(activityHref({ ...base, type: "scenario", params: { scenario_id: "hotel-checkin-problem" } }, 2).params.scenario, "hotel-checkin-problem");
  const l = activityHref({ ...base, type: "listening", params: { listening_id: "lst-en-standup" } }, 2);
  assert.equal(l.pathname, "/listening/[id]");
  assert.equal(l.params.id, "lst-en-standup");
});

test("assessment kind defaults to checkpoint", () => {
  assert.equal(activityHref({ ...base, type: "assessment", params: {} }, 15).params.kind, "checkpoint");
});

test("formatMinutes", () => {
  assert.equal(formatMinutes(45), "45 min");
  assert.equal(formatMinutes(90), "1 h 30 min");
  assert.equal(formatMinutes(120), "2 h");
});
