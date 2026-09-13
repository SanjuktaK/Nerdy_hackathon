import { test } from "node:test";
import assert from "node:assert/strict";

import {
  getCell,
  recordResult,
  replayMastery,
  verdict,
  type MasteryCell,
  type MasteryState,
} from "../lib/policy/mastery";
import type { LearnerEvent } from "../lib/core/types";

const cell = (window: string[]): MasteryCell => ({
  skillId: "place-value-99",
  difficulty: 3,
  representation: "C",
  window,
  seen: window.length,
  correct: window.filter((c) => c === "CORRECT").length,
});

test("advance needs 4 of 5 correct", () => {
  assert.equal(verdict(cell(["CORRECT", "CORRECT", "CORRECT", "CORRECT", "COLUMN_SWAP"])), "ADVANCE");
  assert.equal(verdict(cell(["CORRECT", "CORRECT", "CORRECT", "COLUMN_SWAP", "TENS_OMITTED"])), "HOLD");
});

test("advance needs a full window", () => {
  // Four correct out of four is not 4 of 5. The window has to fill first.
  assert.equal(verdict(cell(["CORRECT", "CORRECT", "CORRECT", "CORRECT"])), "HOLD");
});

test("no misconception twice, even at 4 of 5", () => {
  // Two identical misses in a window is a pattern, not noise — the second
  // clause of §6.1 exists precisely to block this case.
  const w = ["CORRECT", "COLUMN_SWAP", "CORRECT", "CORRECT", "CORRECT"];
  assert.equal(verdict(cell(w)), "ADVANCE");
  assert.equal(
    verdict(cell(["COLUMN_SWAP", "CORRECT", "CORRECT", "CORRECT", "COLUMN_SWAP"])),
    "HOLD"
  );
});

test("three consecutive identical failures step back, and outrank everything", () => {
  assert.equal(verdict(cell(["CORRECT", "CORRECT", "COLUMN_SWAP", "COLUMN_SWAP", "COLUMN_SWAP"])), "STEP_BACK");
  // Different codes in a row are not a run.
  assert.equal(verdict(cell(["CORRECT", "CORRECT", "COLUMN_SWAP", "TENS_OMITTED", "COLUMN_SWAP"])), "HOLD");
  // Three correct in a row is obviously not a step back.
  assert.equal(verdict(cell(["CORRECT", "CORRECT", "CORRECT"])), "HOLD");
});

test("the window is the last five and nothing older", () => {
  let s: MasteryState = {};
  const codes = ["COLUMN_SWAP", "COLUMN_SWAP", "CORRECT", "CORRECT", "CORRECT", "CORRECT", "CORRECT"];
  for (const result of codes) {
    s = recordResult(s, {
      skillId: "place-value-99",
      difficulty: 3,
      representation: "C",
      result,
      phase: "INDEPENDENT",
    });
  }
  const c = getCell(s, "place-value-99", 3, "C");
  assert.deepEqual(c.window, ["CORRECT", "CORRECT", "CORRECT", "CORRECT", "CORRECT"]);
  assert.equal(c.seen, 7);
  assert.equal(verdict(c), "ADVANCE");
});

test("guided results never reach mastery", () => {
  const s = recordResult({}, {
    skillId: "place-value-99",
    difficulty: 3,
    representation: "C",
    result: "CORRECT",
    phase: "GUIDED",
  });
  assert.deepEqual(s, {});
});

test("cells are keyed by skill, difficulty AND representation", () => {
  let s: MasteryState = {};
  s = recordResult(s, { skillId: "a", difficulty: 3, representation: "C", result: "CORRECT", phase: "INDEPENDENT" });
  s = recordResult(s, { skillId: "a", difficulty: 3, representation: "R", result: "COLUMN_SWAP", phase: "INDEPENDENT" });
  s = recordResult(s, { skillId: "a", difficulty: 4, representation: "C", result: "CORRECT", phase: "INDEPENDENT" });
  assert.equal(Object.keys(s).length, 3);
});

test("replaying the log reproduces the state exactly", () => {
  const events: LearnerEvent[] = ["CORRECT", "COLUMN_SWAP", "CORRECT"].map((result, i) => ({
    ts: 1000 + i,
    skillId: "place-value-99",
    taskId: `t${i}`,
    taskType: "REPRESENT",
    targetNumber: 34,
    phase: "INDEPENDENT",
    difficulty: 3,
    representation: "C",
    result,
    latencyMs: 5000,
    promptUsed: false,
    abandoned: false,
    interest: "trains",
    stemSource: "cache",
  }));
  const replayed = replayMastery(events);
  const stepwise = events.reduce<MasteryState>((s, e) => recordResult(s, e), {});
  assert.deepEqual(replayed, stepwise);
});
