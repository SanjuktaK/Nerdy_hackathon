#!/usr/bin/env -S npx tsx
/**
 * Builds the committed warm cache from the seed lexicon — deterministic,
 * offline, no model. Run: npm run stems:seed
 *
 * Every stem is put through validateStem before it is written. If a frame
 * ever drifts out of compliance the build fails here rather than in front
 * of a child.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { SEED_INTERESTS } from "../lib/theme";
import { LEXICON, framesFor, stableHash } from "../lib/content/lexicon";
import { shippingSkills } from "../lib/skills/registry";
import { validateStem } from "../lib/ai/validate";
import { entryKey, type StemBank, type StemEntry } from "../lib/content/schema";

const entries: StemEntry[] = [];
const failures: string[] = [];
const seen = new Set<string>();

for (const skill of shippingSkills()) {
  for (const difficulty of skill.ladder) {
    for (const spec of skill.taskSpace(difficulty)) {
      for (const interest of SEED_INTERESTS) {
        const lx = LEXICON[interest];
        const frames = framesFor(spec.type);
        const frame =
          frames[stableHash(`${interest}:${spec.targetNumber}:${difficulty}`) % frames.length];

        const stem = frame.build(spec.targetNumber, lx, spec.addend ?? 0);
        const entry: StemEntry = {
          skillId: skill.id,
          taskType: spec.type,
          difficulty,
          targetNumber: spec.targetNumber,
          addend: spec.addend,
          interest,
          stem,
          spriteKey: frame.spriteKey,
          source: "template",
        };

        const key = entryKey(entry);
        if (seen.has(key)) continue;
        seen.add(key);

        const v = validateStem(
          { stem, spriteKey: frame.spriteKey },
          {
            skillId: skill.id,
            taskType: spec.type,
            targetNumber: spec.targetNumber,
            addend: spec.addend,
            difficulty,
            interest,
            allowedSpriteKeys: skill.spriteKeys,
          }
        );
        if (!v.ok) {
          failures.push(`${key}\n    "${stem}"\n    ${v.failures.join("; ")}`);
          continue;
        }
        entries.push(entry);
      }
    }
  }
}

if (failures.length) {
  console.error(`\n${failures.length} seed stems failed validateStem:\n`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}

const bank: StemBank = {
  version: 1,
  generatedAt: new Date().toISOString().slice(0, 10),
  producedBy: "template",
  entries,
};

const out = resolve(import.meta.dirname, "../lib/content/stems.json");
writeFileSync(out, JSON.stringify(bank, null, 1) + "\n");

const bySkill = new Map<string, number>();
for (const e of entries) bySkill.set(e.skillId, (bySkill.get(e.skillId) ?? 0) + 1);
console.log(`wrote ${entries.length} stems to ${out}`);
for (const [id, n] of bySkill) console.log(`  ${id}: ${n}`);
console.log(`  interests: ${SEED_INTERESTS.length}`);
