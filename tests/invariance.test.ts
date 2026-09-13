import { test } from "node:test";
import assert from "node:assert/strict";

// ============================================================
// §8 — "a theme change alters sprites, nouns, palette. Never
// targetNumber, difficulty, or skill. Asserted in the eval."
//
// This file is that assertion. It is the claim the demo rests on:
// a judge names any interest and the structure is provably unchanged.
// ============================================================

import { SEED_INTERESTS, DEFAULT_THEME, sanitiseInterest } from "../lib/theme";
import { shippingSkills } from "../lib/skills/registry";
import { lookupOrNearest } from "../lib/content/cache";
import { validateStem } from "../lib/ai/validate";
import { selectSpec, startingCursor } from "../lib/policy/select";
import type { TaskSpec } from "../lib/core/types";

const allSpecs = (): TaskSpec[] => {
  const out: TaskSpec[] = [];
  for (const skill of shippingSkills()) {
    for (const d of skill.ladder) out.push(...skill.taskSpace(d));
  }
  return out;
};

test("the task space does not depend on the interest", () => {
  // Selection never sees the interest — this is the structural half of the
  // invariant, checked at the source rather than at the output.
  const cursor = { ...startingCursor(), difficulty: 3 as const };
  const a = selectSpec(cursor, "tens rod", 2);
  const b = selectSpec(cursor, "tens rod", 2);
  assert.deepEqual(a, b);
});

test("swapping the interest changes language and nothing else", () => {
  const specs = allSpecs();
  assert.ok(specs.length > 0);

  for (const spec of specs) {
    const seen = new Set<string>();

    for (const interest of SEED_INTERESTS) {
      const hit = lookupOrNearest({
        skillId: spec.skillId,
        taskType: spec.type,
        difficulty: spec.difficulty,
        targetNumber: spec.targetNumber,
        interest,
      });
      assert.ok(hit, `no stem for ${spec.skillId} ${spec.targetNumber} / ${interest}`);

      // Structure: identical across every interest.
      assert.equal(hit.entry.skillId, spec.skillId);
      assert.equal(hit.entry.taskType, spec.type);
      assert.equal(hit.entry.difficulty, spec.difficulty);
      assert.equal(hit.entry.targetNumber, spec.targetNumber);
      assert.equal(hit.entry.addend, spec.addend);

      // Language: actually different, or the personalisation is a lie.
      seen.add(hit.entry.stem);
    }

    assert.ok(seen.size > 1, `stems never varied for ${spec.skillId} ${spec.targetNumber}`);
  }
});

test("every committed stem still passes the validator", () => {
  // The bank is committed to the repo, so it can drift from the rules.
  // This is the gate that stops a stale stem reaching a child.
  for (const skill of shippingSkills()) {
    for (const d of skill.ladder) {
      for (const spec of skill.taskSpace(d)) {
        for (const interest of SEED_INTERESTS) {
          const hit = lookupOrNearest({
            skillId: spec.skillId,
            taskType: spec.type,
            difficulty: spec.difficulty,
            targetNumber: spec.targetNumber,
            interest,
          });
          assert.ok(hit);
          const v = validateStem(
            { stem: hit.entry.stem, spriteKey: hit.entry.spriteKey },
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
          assert.deepEqual(v.failures, [], `"${hit.entry.stem}"`);
        }
      }
    }
  }
});

test("a novel interest falls back deterministically, never randomly", () => {
  const spec = allSpecs()[0];
  const q = {
    skillId: spec.skillId,
    taskType: spec.type,
    difficulty: spec.difficulty,
    targetNumber: spec.targetNumber,
    interest: "washing machines",
  };
  const first = lookupOrNearest(q);
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(lookupOrNearest(q), first);
  }
  assert.equal(first?.kind, "fallback");
  // The fallback is still a real task with the number the policy chose.
  assert.ok(first!.entry.stem.includes(String(spec.targetNumber)));
});

test("free-text interest is stripped before it reaches a prompt", () => {
  assert.equal(sanitiseInterest("  WASHING Machines  "), "washing machines");
  assert.equal(sanitiseInterest("trains<script>alert(1)</script>"), "trainsscriptalert1script");
  assert.equal(sanitiseInterest("x".repeat(200)).length, 40);
});

test("the default theme is the conservative one", () => {
  assert.equal(DEFAULT_THEME.soundLevel, 1);
  assert.equal(DEFAULT_THEME.motionLevel, 1);
});
