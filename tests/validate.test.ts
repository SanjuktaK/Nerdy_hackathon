import { test } from "node:test";
import assert from "node:assert/strict";

import {
  validateCorrection,
  validateNarrative,
  validateStem,
  type GenerationRequest,
} from "../lib/ai/validate";

const req = (over: Partial<GenerationRequest> = {}): GenerationRequest => ({
  skillId: "place-value-99",
  taskType: "REPRESENT",
  targetNumber: 34,
  difficulty: 3,
  interest: "trains",
  allowedSpriteKeys: ["group-a", "group-b", "container", "row", "single"],
  ...over,
});

const check = (stem: string, over?: Partial<GenerationRequest>, spriteKey = "group-a") =>
  validateStem({ stem, spriteKey }, req(over));

test("a compliant stem passes", () => {
  const r = check("The engine holds 34 train cars. Show 34.");
  assert.deepEqual(r.failures, []);
  assert.equal(r.ok, true);
});

test("the target numeral must be present as digits", () => {
  assert.ok(check("The engine holds thirty-four train cars.").failures.includes("target numeral absent"));
});

test("stray numerals are rejected — a changed number is a changed task", () => {
  const r = check("The engine holds 34 train cars. 12 more wait.");
  assert.ok(r.failures.some((f) => f.startsWith("stray numeral")));
});

test("the addend is the only other numeral an exchange task may carry", () => {
  const ok = check("Add 6 train cars. The total is 34.", {
    skillId: "compose-tens",
    taskType: "EXCHANGE",
    addend: 6,
  });
  assert.deepEqual(ok.failures, []);
});

test("the target must sit on the rung the policy chose", () => {
  // 34 is a rung-3 number; it does not belong on rung 1 (multiples of ten).
  assert.ok(check("The engine holds 34 train cars.", { difficulty: 1 }).failures
    .includes("target outside difficulty band"));
});

test("an exchange task that cannot carry is rejected", () => {
  const r = check("Add 2 train cars. The total is 34.", {
    skillId: "compose-tens",
    taskType: "EXCHANGE",
    addend: 2,
  });
  assert.ok(r.failures.includes("exchange task does not force a carry"));
});

test("the word ceiling is 14", () => {
  const long = "The very long green engine at the busy station holds exactly 34 small train cars today";
  assert.ok(check(long).failures.includes("too long"));
});

test("banned patterns — the autism-specific filter", () => {
  const cases: [string, string][] = [
    ["The engine does not hold 34 cars.", "banned: negation"],
    ["The engine holds about 34 cars.", "banned: vagueness"],
    ["How many? Is 34 right?", "banned: multiple questions"],
    ["Imagine the engine holds 34 cars.", "banned: counterfactual framing"],
    ["The engine holds 34 cars!", "banned: exclamation (reads as raised volume)"],
    ["The engine holds 34 cars. Show them.", "banned: ambiguous pronoun"],
    ["The engine holds a ton of 34 cars.", "banned: idiom"],
    ["Let's show 34 on the frame.", "banned: first-person plural framing"],
  ];
  for (const [stem, expected] of cases) {
    assert.ok(check(stem).failures.includes(expected), `${stem} → ${expected}`);
  }
});

test("sprite keys outside the skill's set are rejected", () => {
  assert.ok(check("The engine holds 34 train cars.", {}, "dinosaur.png").failures
    .includes("unknown sprite"));
});

test("a malformed object is a schema failure, not a crash", () => {
  const r = validateStem({ stem: 42 as unknown as string, spriteKey: "group-a" }, req());
  assert.equal(r.ok, false);
  assert.ok(r.failures[0].startsWith("schema:"));
});

test("an unknown skill is never given the benefit of the doubt", () => {
  assert.ok(check("The engine holds 34 train cars.", { skillId: "not-a-skill" }).failures
    .some((f) => f.startsWith("unknown skill")));
});

// ---------- Surface B ----------

test("the narrative validator blocks clinical vocabulary", () => {
  for (const text of [
    "The child shows a deficit in place value.",
    "This suggests a possible diagnosis worth exploring.",
    "Performance is below average for grade level.",
    "The child is high functioning with numbers.",
  ]) {
    assert.equal(validateNarrative(text).ok, false, text);
  }
  assert.equal(
    validateNarrative("Four of six tasks were built correctly. Sitting alongside the first task would help.").ok,
    true
  );
});

// ---------- Surface D ----------

test("a shortened correction still obeys every literal-language rule", () => {
  assert.equal(validateCorrection("The left rod holds 3 tens.", 8).ok, true);
  assert.equal(validateCorrection("Do not put them on the left rod.", 8).ok, false);
});

test("a sprite key written into the sentence is a leak, not a word", () => {
  // Small models do this constantly: "the washing machines in group-a".
  assert.ok(check("The 34 washing machines in group-a are counted.").failures
    .some((f) => f.startsWith("sprite key leaked")));
  assert.ok(check("In group b there are 34 socks.").failures
    .some((f) => f.startsWith("sprite key leaked")));

  // But ordinary English that happens to match a key is fine — the seed
  // templates use both of these.
  assert.deepEqual(check("34 train cars line up in one row. Make 34.").failures, []);
  assert.deepEqual(check("The container holds 34 train cars. Show 34.", {}, "container").failures, []);
});

test("an internal representation code must never reach a parent", () => {
  assert.equal(
    validateNarrative("Try more practice with the C beads before moving on.").ok,
    false
  );
  assert.equal(
    validateNarrative("Try more practice with beads they can touch before moving on.").ok,
    true
  );
});
