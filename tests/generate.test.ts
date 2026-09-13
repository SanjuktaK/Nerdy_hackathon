import { test } from "node:test";
import assert from "node:assert/strict";

// ============================================================
// The generation pipeline against a stub provider: retry behaviour,
// what survives validation, and what a malformed model reply does.
// No network, no Ollama — the contract is what is under test.
// ============================================================

import { generateValidated } from "../lib/ai/generate";
import { parseStemBatch } from "../lib/ai/providers/ollama";
import { noneProvider } from "../lib/ai/providers/none";
import type { LLMProvider } from "../lib/ai/types";
import type { GeneratedStem, GenerationRequest } from "../lib/ai/validate";

const req: GenerationRequest = {
  skillId: "place-value-99",
  taskType: "REPRESENT",
  targetNumber: 34,
  difficulty: 3,
  interest: "washing machines",
  allowedSpriteKeys: ["group-a", "group-b", "container", "row", "single"],
};

/** Replays a scripted sequence of batches, one per attempt. */
function stubProvider(batches: GeneratedStem[][]): LLMProvider & { calls: number } {
  let calls = 0;
  const p = {
    id: "ollama" as const,
    label: "stub",
    calls: 0,
    async available() {
      return true;
    },
    async generate() {
      return batches[Math.min(calls++, batches.length - 1)] ?? [];
    },
    async complete() {
      const batch = batches[Math.min(calls++, batches.length - 1)] ?? [];
      return JSON.stringify({ stems: batch });
    },
  };
  Object.defineProperty(p, "calls", { get: () => calls });
  return p as LLMProvider & { calls: number };
}

const good: GeneratedStem = {
  stem: "The washing machine holds 34 socks. Show 34.",
  spriteKey: "container",
};

test("valid candidates come back accepted, on one attempt", async () => {
  const out = await generateValidated(req, { provider: stubProvider([[good, good]]) });
  assert.equal(out.accepted.length, 2);
  assert.equal(out.attempts, 1);
  assert.equal(out.exhausted, false);
});

test("invalid candidates are dropped and reported with their reasons", async () => {
  const provider = stubProvider([
    [
      good,
      { stem: "The washing machine does not hold 34 socks.", spriteKey: "container" },
      { stem: "Show them on the frame.", spriteKey: "container" },
    ],
  ]);
  const out = await generateValidated(req, { provider });
  assert.equal(out.accepted.length, 1);
  assert.equal(out.rejected.length, 2);
  assert.ok(out.rejected.some((r) => r.failures.includes("banned: negation")));
  assert.ok(out.rejected.some((r) => r.failures.includes("target numeral absent")));
});

test("a fully rejected batch triggers exactly one repair pass", async () => {
  const bad = { stem: "Imagine 34 socks!", spriteKey: "container" };
  const provider = stubProvider([[bad, bad], [good]]);
  const out = await generateValidated(req, { provider });
  assert.equal(out.attempts, 2, "one retry, not a loop");
  assert.equal(out.accepted.length, 1);
  assert.equal(out.exhausted, false);
});

test("two failed attempts give up, so the caller can fall back", async () => {
  const bad = { stem: "Maybe 34 socks are in there!", spriteKey: "container" };
  const out = await generateValidated(req, { provider: stubProvider([[bad], [bad]]) });
  assert.equal(out.attempts, 2);
  assert.equal(out.exhausted, true);
  assert.equal(out.accepted.length, 0);
});

test("the naive arm gets no repair pass — that is what it is measuring", async () => {
  const bad = { stem: "Imagine 34 socks!", spriteKey: "container" };
  const out = await generateValidated(req, { provider: stubProvider([[bad], [good]]), naive: true });
  assert.equal(out.attempts, 1);
  assert.equal(out.exhausted, true);
});

test("a provider that throws is reported, not propagated", async () => {
  const out = await generateValidated(req, { provider: noneProvider });
  assert.equal(out.exhausted, true);
  assert.equal(out.providerId, "none");
  assert.ok(out.error);
});

test("an empty batch is a schema failure, not a silent success", async () => {
  const out = await generateValidated(req, { provider: stubProvider([[], []]) });
  assert.equal(out.exhausted, true);
  assert.ok(out.rejected.some((r) => r.failures[0].startsWith("schema")));
});

// ---------- never trust the shape ----------

test("parseStemBatch survives everything a small model does to JSON", () => {
  const expected = [{ stem: "A 34.", spriteKey: "row" }];

  assert.deepEqual(parseStemBatch('{"stems":[{"stem":"A 34.","spriteKey":"row"}]}'), expected);
  assert.deepEqual(parseStemBatch('[{"stem":"A 34.","spriteKey":"row"}]'), expected, "bare array");
  assert.deepEqual(
    parseStemBatch('```json\n{"stems":[{"stem":"A 34.","spriteKey":"row"}]}\n```'),
    expected,
    "fenced block"
  );
  assert.deepEqual(
    parseStemBatch('Sure, here you go:\n[{"stem":"A 34.","spriteKey":"row"}]'),
    expected,
    "preamble before the JSON"
  );
});

test("parseStemBatch returns nothing rather than guessing", () => {
  assert.deepEqual(parseStemBatch(""), []);
  assert.deepEqual(parseStemBatch("I cannot help with that."), []);
  assert.deepEqual(parseStemBatch('{"stems":"not an array"}'), []);
  // Entries missing a stem are dropped; the rest survive.
  assert.deepEqual(
    parseStemBatch('{"stems":[{"spriteKey":"row"},{"stem":"A 34.","spriteKey":"row"}]}'),
    [{ stem: "A 34.", spriteKey: "row" }]
  );
  // A non-string spriteKey becomes empty and then fails validateStem.
  assert.deepEqual(parseStemBatch('[{"stem":"A 34.","spriteKey":7}]'), [
    { stem: "A 34.", spriteKey: "" },
  ]);
});
