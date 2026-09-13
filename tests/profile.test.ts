import { test } from "node:test";
import assert from "node:assert/strict";

import { componentProfile, languageLoad } from "../lib/policy/profile";
import { attentionFlags, splitSessions } from "../lib/policy/flags";
import { summarise, templateNarrative } from "../lib/policy/summary";
import { validateNarrative } from "../lib/ai/validate";
import type { LearnerEvent } from "../lib/core/types";

const DAY = 24 * 60 * 60 * 1000;

const ev = (over: Partial<LearnerEvent> = {}): LearnerEvent => ({
  ts: 1_000_000,
  skillId: "place-value-99",
  taskId: "t",
  taskType: "REPRESENT",
  targetNumber: 34,
  phase: "INDEPENDENT",
  difficulty: 3,
  representation: "C",
  result: "CORRECT",
  latencyMs: 6000,
  promptUsed: false,
  abandoned: false,
  interest: "trains",
  stemSource: "cache",
  ...over,
});

const series = (n: number, over: (i: number) => Partial<LearnerEvent>): LearnerEvent[] =>
  Array.from({ length: n }, (_, i) => ev({ ts: 1_000_000 + i * 60_000, taskId: `t${i}`, ...over(i) }));

test("components need evidence before they claim anything", () => {
  const bars = componentProfile(series(2, () => ({})), () => 8);
  for (const bar of bars) {
    if (bar.samples < 4) assert.equal(bar.score, null);
  }
});

test("a clean run scores place value high; repeated swaps pull it down", () => {
  const clean = componentProfile(series(8, () => ({})), () => 8);
  const pv = clean.find((c) => c.id === "placeValue")!;
  assert.equal(pv.score, 1);

  const messy = componentProfile(
    series(8, (i) => ({ result: i % 2 ? "COLUMN_SWAP" : "CORRECT" })),
    () => 8
  );
  assert.equal(messy.find((c) => c.id === "placeValue")!.score, 0.5);
});

test("exchange and place value are separate bars, as the taxonomy intends", () => {
  // NON_CANONICAL must not look like a place-value problem. That separation
  // is the entire argument for the misconception enum.
  const bars = componentProfile(series(8, () => ({ result: "NON_CANONICAL" })), () => 8);
  assert.equal(bars.find((c) => c.id === "exchange")!.score, 0);
  assert.equal(bars.find((c) => c.id === "placeValue")!.score, 1);
});

test("language load reads latency and accuracy against word count", () => {
  const events = [
    ...series(5, () => ({ latencyMs: 4000, result: "CORRECT" })),
    ...series(5, () => ({ latencyMs: 16000, result: "COLUMN_SWAP", taskId: "long" })),
  ];
  const ll = languageLoad(events, (e) => (e.taskId === "long" ? 13 : 6));
  assert.ok(ll.tolerance !== null && ll.tolerance < 0.5, `tolerance ${ll.tolerance}`);
  assert.equal(ll.maxWords, 8, "a low tolerance shortens what Surface D may write");

  const even = [
    ...series(5, () => ({ latencyMs: 5000 })),
    ...series(5, () => ({ latencyMs: 5000, taskId: "long" })),
  ];
  const flat = languageLoad(even, (e) => (e.taskId === "long" ? 13 : 6));
  assert.equal(flat.tolerance, 1);
  assert.equal(flat.maxWords, 14);
});

test("sessions are split by the gap in the log", () => {
  const events = [ev({ ts: 0 }), ev({ ts: 60_000 }), ev({ ts: 60_000 + 2 * 60 * 60 * 1000 })];
  assert.equal(splitSessions(events).length, 2);
});

test("a misconception across three sessions raises one flag", () => {
  const events = [0, 1, 2].flatMap((d) =>
    series(3, () => ({ result: "COLUMN_SWAP" })).map((e, i) => ({
      ...e,
      ts: 1_000_000 + d * DAY + i * 60_000,
    }))
  );
  const flags = attentionFlags(events, 1_000_000 + 3 * DAY);
  assert.ok(flags.some((f) => f.id === "PERSISTENT_MISCONCEPTION"));
});

test("abandonment above a quarter of tasks is flagged", () => {
  const events = series(10, (i) => ({ abandoned: i < 4 }));
  assert.ok(attentionFlags(events).some((f) => f.id === "ABANDONMENT"));
  assert.ok(!attentionFlags(series(10, () => ({}))).some((f) => f.id === "ABANDONMENT"));
});

test("an accuracy collapse at one representation is flagged as a gap", () => {
  const events = [
    ...series(5, () => ({ representation: "C" as const, result: "CORRECT" })),
    ...series(5, () => ({ representation: "A" as const, result: "COLUMN_SWAP", taskId: "a" })),
  ];
  assert.ok(attentionFlags(events).some((f) => f.id === "REPRESENTATION_GAP"));
});

test("every flag reads as an observation, never as a diagnosis", () => {
  const events = series(12, (i) => ({ result: i % 2 ? "COLUMN_SWAP" : "CORRECT", abandoned: i < 5 }));
  for (const flag of attentionFlags(events)) {
    assert.equal(validateNarrative(flag.text, 60).ok, true, flag.text);
  }
});

test("the template narrative is clinical-vocabulary-free by construction", () => {
  const s = summarise(series(9, (i) => ({ result: i % 3 ? "CORRECT" : "NON_CANONICAL" })));
  const text = templateNarrative(s);
  assert.equal(validateNarrative(text, 140).ok, true, text);
  assert.ok(text.includes("6 of 9"));
  assert.ok(/ten ones/i.test(text), "the plain label replaces the error code");
  assert.ok(!/NON_CANONICAL/.test(text), "no raw code ever reaches a parent");
});

test("an empty log produces a sentence, not a crash", () => {
  assert.equal(templateNarrative(summarise([])), "No tasks were finished in this session yet.");
  assert.deepEqual(attentionFlags([]), []);
});
