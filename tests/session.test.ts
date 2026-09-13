import { test } from "node:test";
import assert from "node:assert/strict";

import {
  initialSession,
  previewText,
  sessionReducer,
  type SessionState,
} from "../lib/session/machine";
import { startingCursor } from "../lib/policy/select";
import { exchangeTriple } from "../lib/skills/compose-tens";
import { beadValue } from "../lib/core/bead-frame";
import { shippingSkills } from "../lib/skills/registry";
import type { Task } from "../lib/core/types";

const plan = { tasksPerBlock: 3, blocks: 2 };

const task = (): Task => ({
  id: "t1",
  skillId: "place-value-99",
  type: "REPRESENT",
  targetNumber: 34,
  difficulty: 3,
  focusTags: [],
  interest: "trains",
  spriteKey: "group-a",
  stem: "The engine holds 34 train cars. Show 34.",
  representation: "C",
  stemSource: "cache",
});

const ready = (s: SessionState) =>
  sessionReducer(s, {
    type: "TASK_READY",
    task: task(),
    work: { tens: 0, ones: 0 },
    cursor: s.cursor,
    showModel: true,
  });

test("the session opens on PREVIEW and waits for the child", () => {
  const s = initialSession(plan, startingCursor(), 0);
  assert.equal(s.phase, "PREVIEW");
  assert.equal(s.loading, true);
  // Nothing advances until a task exists — PREVIEW is the wait screen.
  assert.equal(sessionReducer(s, { type: "PREVIEW_DONE" }).phase, "PREVIEW");
});

test("the full I-do / we-do / you-do arc", () => {
  let s = ready(initialSession(plan, startingCursor(), 0));
  assert.equal(s.loading, false);

  s = sessionReducer(s, { type: "PREVIEW_DONE" });
  assert.equal(s.phase, "MODEL");

  s = sessionReducer(s, { type: "MODEL_DONE" });
  assert.equal(s.phase, "GUIDED");

  s = sessionReducer(s, { type: "GUIDED_SUBMIT", code: "CORRECT", hint: null });
  assert.equal(s.phase, "FEEDBACK");

  s = sessionReducer(s, { type: "GUIDED_ACCEPT", work: { tens: 0, ones: 0 } });
  assert.equal(s.phase, "INDEPENDENT");

  s = sessionReducer(s, { type: "INDEPENDENT_SUBMIT", code: "CORRECT" });
  assert.equal(s.phase, "FEEDBACK");

  s = sessionReducer(s, { type: "FEEDBACK_DONE" });
  assert.equal(s.index, 1);
  assert.equal(s.phase, "PREVIEW");
});

test("a wrong guided answer retries with a hint, and is never marked wrong", () => {
  let s = ready(initialSession(plan, startingCursor(), 0));
  s = sessionReducer(s, { type: "PREVIEW_DONE" });
  s = sessionReducer(s, { type: "MODEL_DONE" });

  const hint = { slot: "tens", value: 3, message: "The left rod holds 3 tens." };
  s = sessionReducer(s, { type: "GUIDED_SUBMIT", code: "COLUMN_SWAP", hint });

  // Still in GUIDED, hint showing, the child's work untouched.
  assert.equal(s.phase, "GUIDED");
  assert.deepEqual(s.hint, hint);
  assert.equal(s.retries, 1);
});

test("after the retry budget the walkthrough returns rather than leaving the child stuck", () => {
  let s = ready(initialSession(plan, startingCursor(), 0));
  s = sessionReducer(s, { type: "PREVIEW_DONE" });
  s = sessionReducer(s, { type: "MODEL_DONE" });
  for (let i = 0; i < 3; i++) {
    s = sessionReducer(s, { type: "GUIDED_SUBMIT", code: "COLUMN_SWAP", hint: null });
  }
  assert.equal(s.phase, "MODEL");
  assert.equal(s.modelStep, 0);
});

test("a break arrives after each block, and never mid-block", () => {
  let s = ready(initialSession(plan, startingCursor(), 0));
  const finishTask = () => {
    s = sessionReducer(s, { type: "INDEPENDENT_SUBMIT", code: "CORRECT" });
    s = sessionReducer(s, { type: "FEEDBACK_DONE" });
  };
  finishTask();
  assert.equal(s.phase, "PREVIEW");
  s = ready(s);
  finishTask();
  assert.equal(s.phase, "PREVIEW");
  s = ready(s);
  finishTask();
  assert.equal(s.phase, "BREAK", "a break follows the third task");
  assert.equal(s.index, 3);
});

test("the session ends after the planned number of tasks", () => {
  let s = ready(initialSession(plan, startingCursor(), 0));
  for (let i = 0; i < 6; i++) {
    s = sessionReducer(s, { type: "INDEPENDENT_SUBMIT", code: "CORRECT" });
    s = sessionReducer(s, { type: "FEEDBACK_DONE" });
    if (s.phase === "BREAK") s = sessionReducer(s, { type: "BREAK_DONE" });
    if (s.phase !== "DONE") s = ready(s);
  }
  assert.equal(s.phase, "DONE");
  assert.equal(s.index, 6);
});

test("PREVIEW copy counts the tasks and names the break", () => {
  const s = initialSession(plan, startingCursor(), 0);
  assert.equal(previewText(s), "Next: 3 number tasks. Then a break.");
  assert.equal(previewText({ ...s, index: 3 }), "Next: 3 number tasks. Then the session ends.");
  assert.equal(previewText({ ...s, index: 5 }), "Next: 1 number task. Then the session ends.");
});

test("abandoning still produces a classified, logged outcome", () => {
  let s = ready(initialSession(plan, startingCursor(), 0));
  s = sessionReducer(s, { type: "ABANDON" });
  assert.equal(s.phase, "FEEDBACK");
  assert.equal(s.independentCode, "UNCLASSIFIED");
});

// ---------- exchange construction ----------

test("every shipped exchange task actually forces a carry", () => {
  const skill = shippingSkills().find((s) => s.id === "compose-tens")!;
  for (const d of skill.ladder) {
    for (const spec of skill.taskSpace(d)) {
      const start = spec.startState as { tens: number; ones: number };
      const addend = spec.addend!;
      assert.ok(start.ones + addend >= 10, `${spec.targetNumber} does not overflow`);
      assert.ok(start.ones <= 9, `${spec.targetNumber} starts non-canonical`);
      assert.equal(beadValue(start) + addend, spec.targetNumber);
      // The validator's own weaker check must hold too.
      assert.ok((spec.targetNumber % 10) + addend >= 10);
    }
  }
});

test("exchangeTriple refuses targets that cannot carry with one digit", () => {
  assert.throws(() => exchangeTriple(90));
  assert.throws(() => exchangeTriple(19));
});

test("the walkthrough is skipped on ground the child has already worked", () => {
  const base = initialSession(plan, startingCursor(), 0);

  const familiar = sessionReducer(base, {
    type: "TASK_READY",
    task: task(),
    work: { tens: 0, ones: 0 },
    cursor: base.cursor,
    showModel: false,
  });
  assert.equal(sessionReducer(familiar, { type: "PREVIEW_DONE" }).phase, "GUIDED");

  const fresh = sessionReducer(base, {
    type: "TASK_READY",
    task: task(),
    work: { tens: 0, ones: 0 },
    cursor: base.cursor,
    showModel: true,
  });
  assert.equal(sessionReducer(fresh, { type: "PREVIEW_DONE" }).phase, "MODEL");
});

test("the child can always ask for the walkthrough from GUIDED", () => {
  let s = sessionReducer(initialSession(plan, startingCursor(), 0), {
    type: "TASK_READY",
    task: task(),
    work: { tens: 0, ones: 0 },
    cursor: startingCursor(),
    showModel: false,
  });
  s = sessionReducer(s, { type: "PREVIEW_DONE" });
  assert.equal(s.phase, "GUIDED");
  s = sessionReducer(s, { type: "SHOW_MODEL" });
  assert.equal(s.phase, "MODEL");
  assert.equal(s.modelStep, 0);
});
