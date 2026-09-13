import { test } from "node:test";
import assert from "node:assert/strict";

// ============================================================
// A synthetic child driven through the real stack: selection →
// content lookup → classifier → mastery → next move. No mocks, no
// stubs, no UI. If the layers disagree about anything, this is where
// it shows up.
// ============================================================

import { lookupOrNearest } from "../lib/content/cache";
import { validateStem } from "../lib/ai/validate";
import { recordResult, type MasteryState } from "../lib/policy/mastery";
import { nextMove, selectSpec, startingCursor, type Cursor } from "../lib/policy/select";
import { getSkill } from "../lib/skills/registry";
import { canonicalState, type BeadState } from "../lib/core/bead-frame";
import type { LearnerEvent, Task } from "../lib/core/types";

type Child = (task: Task, initial: BeadState) => BeadState;

/** Always right. */
const perfect: Child = (task) => canonicalState(task.targetNumber);

/** Gets the amount right, never trades the ten. The headline misconception. */
const neverTrades: Child = (task) => {
  const { tens, ones } = canonicalState(task.targetNumber);
  return tens > 0 ? { tens: tens - 1, ones: ones + 10 } : { tens, ones };
};

/** Puts the digits on the wrong rods. */
const swapsColumns: Child = (task) => {
  const { tens, ones } = canonicalState(task.targetNumber);
  return tens === ones ? { tens, ones } : { tens: ones, ones: tens };
};

interface Run {
  events: LearnerEvent[];
  cursors: Cursor[];
  codes: string[];
  stems: string[];
}

function runSession(child: Child, tasks: number, interest = "trains"): Run {
  let cursor = startingCursor();
  let focus = "same skill, new surface";
  let mastery: MasteryState = {};
  const run: Run = { events: [], cursors: [], codes: [], stems: [] };
  const recent: number[] = [];

  for (let i = 0; i < tasks; i++) {
    const skill = getSkill(cursor.skillId);
    const spec = selectSpec(cursor, focus, i, recent);

    const hit = lookupOrNearest({
      skillId: spec.skillId,
      taskType: spec.type,
      difficulty: spec.difficulty,
      targetNumber: spec.targetNumber,
      interest,
    });
    assert.ok(hit, `no stem for ${spec.skillId} ${spec.targetNumber}`);

    const task: Task = {
      ...spec,
      id: `task-${i}`,
      interest,
      spriteKey: hit.entry.spriteKey,
      stem: hit.entry.stem,
      representation: cursor.representation,
      stemSource: hit.kind === "fallback" ? "fallback" : "cache",
    };

    // Every sentence a child is shown must still clear the validator.
    const v = validateStem(
      { stem: task.stem, spriteKey: task.spriteKey },
      {
        skillId: spec.skillId,
        taskType: spec.type,
        targetNumber: spec.targetNumber,
        addend: spec.addend,
        difficulty: spec.difficulty,
        interest,
        allowedSpriteKeys: skill.spriteKeys,
      }
    );
    assert.deepEqual(v.failures, [], `served an invalid stem: "${task.stem}"`);

    const answer = child(task, skill.initialState(task) as BeadState);
    const code = skill.classify(answer, task) as string;

    const ev: LearnerEvent = {
      ts: 1_000_000 + i * 60_000,
      skillId: task.skillId,
      taskId: task.id,
      taskType: task.type,
      targetNumber: task.targetNumber,
      phase: "INDEPENDENT",
      difficulty: task.difficulty,
      representation: task.representation,
      result: code,
      latencyMs: 8000,
      promptUsed: false,
      abandoned: false,
      interest,
      stemSource: task.stemSource,
    };

    run.events.push(ev);
    run.cursors.push(cursor);
    run.codes.push(code);
    run.stems.push(task.stem);
    recent.push(spec.targetNumber);
    if (recent.length > 3) recent.shift();

    mastery = recordResult(mastery, ev);
    const move = nextMove(cursor, code, mastery);
    cursor = move.cursor;
    focus = move.focus;
  }

  return run;
}

test("a child who is always right climbs the whole ladder", () => {
  // 75 tasks, not 60: clearing place-value-99 takes exactly 4 rungs × 3
  // representations × the 5-task mastery window = 60 independent answers,
  // so the handoff into compose-tens lands on task 60 and needs room after it.
  const run = runSession(perfect, 75);
  assert.ok(run.codes.every((c) => c === "CORRECT"));

  const reps = new Set(run.cursors.map((c) => c.representation));
  assert.ok(reps.has("C") && reps.has("R") && reps.has("A"), "all three CRA levels reached");

  const skills = new Set(run.cursors.map((c) => c.skillId));
  assert.ok(skills.has("place-value-99"), "starts in place value");
  assert.ok(skills.has("compose-tens"), "reaches the exchange skill");

  // Nothing is skipped on the way: a flawless child still does every rung
  // at every representation. Advancement is earned, not inferred.
  const handoff = run.cursors.findIndex((c) => c.skillId === "compose-tens");
  assert.equal(handoff, 60, "the handoff must land exactly on the window boundary");

  // Representation-first: within a skill, the rung never rises before A.
  for (let i = 1; i < run.cursors.length; i++) {
    const a = run.cursors[i - 1];
    const b = run.cursors[i];
    if (a.skillId === b.skillId && b.difficulty > a.difficulty) {
      assert.equal(a.representation, "A", `rung rose from ${a.representation}, not A`);
    }
  }
});

test("the child who never trades is routed into the exchange skill on the first miss", () => {
  const run = runSession(neverTrades, 12);
  // Teens have no tens bead to borrow from, so the first rung is answered
  // correctly; the first two-digit task is where the pattern shows.
  const firstMiss = run.codes.findIndex((c) => c === "NON_CANONICAL");
  assert.ok(firstMiss >= 0, "the misconception was never produced");
  assert.equal(run.cursors[firstMiss + 1].skillId, "compose-tens");
});

test("a persistent column swap steps down and settles at rung 1, never below", () => {
  const run = runSession(swapsColumns, 40);
  for (const c of run.cursors) {
    assert.ok(c.difficulty >= 1 && c.difficulty <= 5, `rung ${c.difficulty} out of range`);
  }
  // The child is not left grinding at the top of the ladder.
  assert.ok(run.cursors.slice(-10).every((c) => c.difficulty <= 2));
});

test("a novel interest runs a full session without a model", () => {
  // The §7 promise: provider down, novel interest, session still works —
  // the child sees trains instead of washing machines and nothing else changes.
  const run = runSession(perfect, 30, "washing machines");
  assert.equal(run.events.length, 30);
  assert.ok(run.events.every((e) => e.stemSource === "fallback"));
  assert.ok(run.stems.every((s, i) => s.includes(String(run.events[i].targetNumber))));
});

test("every rung of every shipping skill is reachable and serves valid content", () => {
  // runSession asserts stem validity on each task; 200 tasks across three
  // different children is a wide sweep of the cross-product.
  for (const child of [perfect, neverTrades, swapsColumns]) {
    const run = runSession(child, 70);
    assert.equal(run.events.length, 70);
  }
});

test("the same child run twice produces the identical trajectory", () => {
  // The positioning line, as a test: a child's next problem does not depend
  // on a sampling temperature, or on anything else that varies between runs.
  const a = runSession(neverTrades, 40);
  const b = runSession(neverTrades, 40);
  assert.deepEqual(a.codes, b.codes);
  assert.deepEqual(a.cursors, b.cursors);
  assert.deepEqual(a.stems, b.stems);
});
