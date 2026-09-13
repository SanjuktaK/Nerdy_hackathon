#!/usr/bin/env -S npx tsx
/**
 * §13 day 14 — the offline batch run that widens the committed warm cache.
 *
 *   npm run stems:generate                      # all seed interests
 *   npm run stems:generate -- --interest "washing machines"
 *   npm run stems:generate -- --dry
 *
 * Merges into lib/content/stems.json rather than replacing it, so a run
 * that only half-finishes leaves the app with a bank that still works.
 * Every generated stem goes through validateStem first; rejects are
 * reported and dropped, never written.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { resolveProvider } from "../lib/ai/provider";
import { generateValidated, BATCH_SIZE } from "../lib/ai/generate";
import { shippingSkills } from "../lib/skills/registry";
import { SEED_INTERESTS, normaliseInterest } from "../lib/theme";
import { entryKey, type StemBank, type StemEntry } from "../lib/content/schema";
import type { TaskSpec } from "../lib/core/types";

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1] ?? "true");
}

const dry = args.has("dry");
const interests = args.has("interest")
  ? [normaliseInterest(args.get("interest")!)]
  : [...SEED_INTERESTS];
const perKey = Number(args.get("per-key") ?? 1);

const bankPath = resolve(import.meta.dirname, "../lib/content/stems.json");
const bank = JSON.parse(readFileSync(bankPath, "utf8")) as StemBank;
const existing = new Set(bank.entries.map(entryKey));

const provider = await resolveProvider();
if (provider.id === "none") {
  console.error(
    "No language model is reachable.\n" +
      "Start Ollama (`ollama serve`, `ollama pull llama3.2:3b`) or configure the hosted provider."
  );
  process.exit(1);
}

const specs: TaskSpec[] = [];
for (const skill of shippingSkills()) {
  for (const d of skill.ladder) specs.push(...skill.taskSpace(d));
}

const total = specs.length * interests.length;
console.log(`provider: ${provider.label}`);
console.log(`${specs.length} tasks × ${interests.length} interests = ${total} keys\n`);

const added: StemEntry[] = [];
let skipped = 0;
let failed = 0;
let done = 0;

for (const interest of interests) {
  for (const spec of specs) {
    const probe: StemEntry = {
      skillId: spec.skillId,
      taskType: spec.type,
      difficulty: spec.difficulty,
      targetNumber: spec.targetNumber,
      addend: spec.addend,
      interest,
      stem: "",
      spriteKey: "",
      source: "generated",
    };

    done += 1;
    if (existing.has(entryKey(probe))) {
      skipped += 1;
      process.stdout.write(`\r[${done}/${total}] cached · ${interest} ${spec.targetNumber}      `);
      continue;
    }

    const skill = shippingSkills().find((s) => s.id === spec.skillId)!;
    const outcome = await generateValidated(
      {
        skillId: spec.skillId,
        taskType: spec.type,
        targetNumber: spec.targetNumber,
        addend: spec.addend,
        difficulty: spec.difficulty,
        interest,
        allowedSpriteKeys: skill.spriteKeys,
      },
      { count: BATCH_SIZE, provider }
    );

    if (outcome.accepted.length === 0) {
      failed += 1;
      process.stdout.write(
        `\r[${done}/${total}] rejected · ${interest} ${spec.targetNumber} · ` +
          `${outcome.rejected.flatMap((r) => r.failures).slice(0, 2).join(", ")}      \n`
      );
      continue;
    }

    for (const g of outcome.accepted.slice(0, perKey)) {
      added.push({ ...probe, stem: g.stem, spriteKey: g.spriteKey });
    }
    process.stdout.write(
      `\r[${done}/${total}] +${outcome.accepted.length} · ${interest} ${spec.targetNumber} · ${outcome.latencyMs}ms      `
    );
  }
}

process.stdout.write("\n\n");
console.log(`added ${added.length} · already cached ${skipped} · gave up on ${failed}`);

if (dry) {
  console.log("\n--dry: nothing written. Sample:");
  for (const e of added.slice(0, 8)) console.log(`  [${e.interest}] ${e.stem}`);
  process.exit(0);
}

if (added.length === 0) {
  console.log("nothing to write");
  process.exit(0);
}

const merged: StemBank = {
  ...bank,
  generatedAt: new Date().toISOString().slice(0, 10),
  producedBy: bank.producedBy === "template" ? `template + ${provider.label}` : bank.producedBy,
  entries: [...bank.entries, ...added],
};
writeFileSync(bankPath, JSON.stringify(merged, null, 1) + "\n");
console.log(`\nwrote ${merged.entries.length} stems to ${bankPath}`);
