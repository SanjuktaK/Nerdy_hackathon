import { test } from "node:test";
import assert from "node:assert/strict";

import { nextMove, selectSpec, startingCursor, type Cursor } from "../lib/policy/select";
import { recordResult, type MasteryState } from "../lib/policy/mastery";
import { shippingSkills } from "../lib/skills/registry";

const mastered = (c: Cursor): MasteryState => {
  let s: MasteryState = {};
  for (const result of ["CORRECT", "CORRECT", "CORRECT", "CORRECT", "CORRECT"]) {
    s = recordResult(s, { ...c, result, phase: "INDEPENDENT" });
  }
  return s;
};

const start = startingCursor();

test("a correct answer with an unfilled window holds", () => {
  const m = nextMove(start, "CORRECT", {});
  assert.equal(m.reason, "hold");
  assert.deepEqual(m.cursor, start);
});

test("advancement is representation-first, then difficulty", () => {
  const c: Cursor = { ...start, representation: "C" };
  const toR = nextMove(c, "CORRECT", mastered(c));
  assert.equal(toR.reason, "advance-representation");
  assert.equal(toR.cursor.representation, "R");
  assert.equal(toR.cursor.difficulty, c.difficulty);

  const atR = { ...c, representation: "R" as const };
  const toA = nextMove(atR, "CORRECT", mastered(atR));
  assert.equal(toA.cursor.representation, "A");
  assert.equal(toA.cursor.difficulty, c.difficulty);

  const atA = { ...c, representation: "A" as const };
  const up = nextMove(atA, "CORRECT", mastered(atA));
  assert.equal(up.reason, "advance-difficulty");
  assert.equal(up.cursor.difficulty, c.difficulty + 1);
  // Difficulty up means back to something the child can touch.
  assert.equal(up.cursor.representation, "C");
});

test("the ceiling of one skill hands off to the next shipping skill", () => {
  const [first, second] = shippingSkills();
  const top = first.ladder[first.ladder.length - 1];
  const atCeiling: Cursor = { skillId: first.id, difficulty: top, representation: "A" };
  const m = nextMove(atCeiling, "CORRECT", mastered(atCeiling));
  assert.equal(m.reason, "advance-skill");
  assert.equal(m.cursor.skillId, second.id);
  assert.equal(m.cursor.representation, "C");
});

test("NON_CANONICAL routes into the exchange skill by focus tag", () => {
  // The policy never names a skill. The remediation focus does the routing:
  // "ten ones become one ten" only exists in compose-tens' task space.
  const m = nextMove({ ...start, difficulty: 3 }, "NON_CANONICAL", {});
  assert.equal(m.reason, "remediate");
  assert.equal(m.focus, "ten ones become one ten");
  assert.equal(m.cursor.skillId, "compose-tens");
});

test("COLUMN_SWAP drops to rung 1 and back to concrete", () => {
  const c: Cursor = { ...start, difficulty: 4, representation: "A" };
  const m = nextMove(c, "COLUMN_SWAP", {});
  assert.equal(m.cursor.difficulty, 1);
  assert.equal(m.cursor.representation, "C");
  assert.equal(m.focus, "rod identity before rod contents");
});

test("OFF_BY_ONE holds the rung and the representation", () => {
  const c: Cursor = { ...start, difficulty: 3, representation: "R" };
  const m = nextMove(c, "OFF_BY_ONE_ONES", {});
  assert.equal(m.reason, "hold");
  assert.deepEqual(m.cursor, c);
});

test("three identical failures step the rung down", () => {
  const c: Cursor = { ...start, difficulty: 3 };
  let m: MasteryState = {};
  for (const result of ["COLUMN_SWAP", "COLUMN_SWAP", "COLUMN_SWAP"]) {
    m = recordResult(m, { ...c, result, phase: "INDEPENDENT" });
  }
  const move = nextMove(c, "CORRECT", m);
  assert.equal(move.reason, "step-back");
  assert.equal(move.cursor.difficulty, 2);
});

test("an unknown code falls back to the UNCLASSIFIED row", () => {
  const m = nextMove(start, "SOMETHING_THE_MODEL_MADE_UP", {});
  assert.equal(m.cursor.difficulty, 1);
  assert.equal(m.focus, "reset to known ground");
});

test("selection is deterministic and avoids repeating a target", () => {
  const c: Cursor = { ...start, difficulty: 3 };
  const a = selectSpec(c, "tens rod", 0);
  const b = selectSpec(c, "tens rod", 0);
  assert.deepEqual(a, b, "same inputs must give the same task");

  const next = selectSpec(c, "tens rod", 1, [a.targetNumber]);
  assert.notEqual(next.targetNumber, a.targetNumber);
});

test("every shipping skill has a non-empty task space on every rung", () => {
  for (const skill of shippingSkills()) {
    for (const d of skill.ladder) {
      assert.ok(skill.taskSpace(d).length > 0, `${skill.id} @ ${d}`);
    }
  }
});

test("an unmatched focus still returns a task rather than nothing", () => {
  const spec = selectSpec({ ...start, difficulty: 3 }, "a focus nobody declares", 0);
  assert.equal(spec.skillId, start.skillId);
});
