import { test } from "node:test";
import assert from "node:assert/strict";

import { classifyBeadState, type BeadCode } from "../lib/skills/bead-common";
import { ONES_CAPACITY, type BeadState } from "../lib/core/bead-frame";
import type { Task } from "../lib/core/types";

const represent = (target: number): Task => ({
  id: "t",
  skillId: "place-value-99",
  type: "REPRESENT",
  targetNumber: target,
  difficulty: 3,
  focusTags: [],
  interest: "trains",
  spriteKey: "group-a",
  stem: `Show ${target}.`,
  representation: "C",
  stemSource: "cache",
});

const exchangeTask = (target: number, addend: number, start: BeadState): Task => ({
  ...represent(target),
  skillId: "compose-tens",
  type: "EXCHANGE",
  addend,
  startState: start,
});

const check = (state: BeadState, task: Task, expected: BeadCode) =>
  assert.equal(classifyBeadState(state, task), expected, JSON.stringify(state));

test("CORRECT is the canonical state only", () => {
  check({ tens: 3, ones: 4 }, represent(34), "CORRECT");
  check({ tens: 2, ones: 0 }, represent(20), "CORRECT");
});

test("NON_CANONICAL: right total, ones not exchanged", () => {
  // The headline case. Every scoring app marks this wrong and moves on.
  check({ tens: 2, ones: 14 }, represent(34), "NON_CANONICAL");
  check({ tens: 1, ones: 19 }, represent(29), "NON_CANONICAL");
});

test("NON_CANONICAL is tested before the error branches", () => {
  // 2 tens + 14 ones would also satisfy no other rule, but the guard matters
  // for states that could read as a swap or an omission at the same time.
  check({ tens: 0, ones: 20 }, represent(20), "NON_CANONICAL");
});

test("COLUMN_SWAP only when the digits differ", () => {
  check({ tens: 4, ones: 3 }, represent(34), "COLUMN_SWAP");
  // 44 has identical digits, so a "swap" is indistinguishable from correct.
  check({ tens: 4, ones: 4 }, represent(44), "CORRECT");
});

test("COUNTING_ALL: everything on the ones rod, nothing on the tens", () => {
  check({ tens: 0, ones: ONES_CAPACITY }, represent(34), "COUNTING_ALL");
  check({ tens: 0, ones: 15 }, represent(34), "COUNTING_ALL");
  // A teen built as loose ones has the right value in the wrong form, and
  // NON_CANONICAL is tested first — so it wins, which is the correct lesson:
  // the child has the amount and needs the exchange, not a counting drill.
  check({ tens: 0, ones: 13 }, represent(13), "NON_CANONICAL");
});

test("omissions", () => {
  check({ tens: 0, ones: 4 }, represent(34), "TENS_OMITTED");
  check({ tens: 3, ones: 0 }, represent(34), "ONES_OMITTED");
  // A target with a zero ones digit cannot be an ones-omission.
  check({ tens: 2, ones: 0 }, represent(20), "CORRECT");
});

test("off by one, per rod", () => {
  check({ tens: 3, ones: 5 }, represent(34), "OFF_BY_ONE_ONES");
  check({ tens: 3, ones: 3 }, represent(34), "OFF_BY_ONE_ONES");
  check({ tens: 4, ones: 4 }, represent(34), "OFF_BY_ONE_TENS");
  check({ tens: 2, ones: 4 }, represent(34), "OFF_BY_ONE_TENS");
});

test("CARRY_DROPPED only on exchange tasks", () => {
  const task = exchangeTask(34, 6, { tens: 2, ones: 8 });
  // Ten ones left the rod, the ten never landed: 24, ten short.
  check({ tens: 2, ones: 4 }, task, "CARRY_DROPPED");
  // The same state on a represent task is an ordinary tens error.
  check({ tens: 2, ones: 4 }, represent(34), "OFF_BY_ONE_TENS");
});

test("UNCLASSIFIED is the honest default", () => {
  check({ tens: 7, ones: 1 }, represent(34), "UNCLASSIFIED");
  check({ tens: 9, ones: 9 }, represent(34), "UNCLASSIFIED");
});

test("NON_CANONICAL and CARRY_DROPPED are different next lessons", () => {
  const task = exchangeTask(34, 6, { tens: 2, ones: 8 });
  const nonCanonical = classifyBeadState({ tens: 2, ones: 14 }, task);
  const dropped = classifyBeadState({ tens: 2, ones: 4 }, task);
  assert.equal(nonCanonical, "NON_CANONICAL");
  assert.equal(dropped, "CARRY_DROPPED");
  assert.notEqual(nonCanonical, dropped);
});
