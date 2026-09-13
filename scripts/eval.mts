#!/usr/bin/env -S npx tsx
/**
 * §10 Eval harness.
 *
 *   npm run eval                       # both arms, seed + novel interests
 *   npm run eval -- --novel "washing machines,elevators"
 *   npm run eval -- --arms constrained --per-rung 1
 *
 * Baseline naive prompt vs constrained pipeline, run offline over the
 * cache's task space plus a novel-interest sample. Nothing is simulated:
 * with no provider reachable the run stops and says so, because a chart
 * built from invented numbers is worse than no chart.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { resolveProvider } from "../lib/ai/provider";
import { generateValidated, BATCH_SIZE } from "../lib/ai/generate";
import { validateStem, countWords, type GenerationRequest } from "../lib/ai/validate";
import { shippingSkills } from "../lib/skills/registry";
import { SEED_INTERESTS } from "../lib/theme";
import { summariseArm } from "../lib/eval/summarise";
import type { Arm, EvalReport, EvalRow } from "../lib/eval/types";
import type { TaskSpec } from "../lib/core/types";

// ---------- args ----------

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1] ?? "");
}

const perRung = Number(args.get("per-rung") ?? 2);
const arms: Arm[] = (args.get("arms") ?? "naive,constrained").split(",") as Arm[];
const novelInterests = (args.get("novel") ?? "washing machines,elevators,vacuum cleaners")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const seedSample = (args.get("seeds") ?? SEED_INTERESTS.slice(0, 3).join(","))
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ---------- plan ----------

const specs: TaskSpec[] = [];
for (const skill of shippingSkills()) {
  for (const d of skill.ladder) {
    specs.push(...skill.taskSpace(d).slice(0, perRung));
  }
}

const interests = [
  ...seedSample.map((i) => ({ interest: i, novel: false })),
  ...novelInterests.map((i) => ({ interest: i, novel: true })),
];

// ---------- run ----------

const provider = await resolveProvider();
if (provider.id === "none") {
  console.error(
    "No language model is reachable, so there is nothing to evaluate.\n" +
      "Start Ollama (`ollama serve` and `ollama pull llama3.2:3b`), or set\n" +
      "HOSTED_LLM_BASE_URL / HOSTED_LLM_API_KEY / HOSTED_LLM_MODEL, then run again."
  );
  process.exit(1);
}

const total = specs.length * interests.length * arms.length;
console.log(
  `provider: ${provider.label}\n` +
    `${specs.length} tasks × ${interests.length} interests × ${arms.length} arms = ${total} requests\n`
);

const rows: EvalRow[] = [];
const requestsByArm: Record<Arm, { key: string; accepted: boolean; attempts: number; latencyMs: number }[]> = {
  naive: [],
  constrained: [],
};

let done = 0;
for (const arm of arms) {
  for (const { interest, novel } of interests) {
    for (const spec of specs) {
      const skill = shippingSkills().find((s) => s.id === spec.skillId)!;
      const req: GenerationRequest = {
        skillId: spec.skillId,
        taskType: spec.type,
        targetNumber: spec.targetNumber,
        addend: spec.addend,
        difficulty: spec.difficulty,
        interest,
        allowedSpriteKeys: skill.spriteKeys,
      };

      const outcome = await generateValidated(req, {
        count: BATCH_SIZE,
        provider,
        naive: arm === "naive",
      });

      const candidates = [
        ...outcome.accepted.map((g) => ({ ...g, accepted: true })),
        ...outcome.rejected.map((r) => ({ stem: r.stem, spriteKey: "", accepted: false })),
      ];

      for (const c of candidates) {
        // Re-run the validator per candidate so each metric is attributable
        // rather than inferred from the accept/reject decision.
        const v = validateStem({ stem: c.stem, spriteKey: c.spriteKey || "group-a" }, req);
        const f = v.failures;
        rows.push({
          arm,
          interest,
          novel,
          skillId: spec.skillId,
          taskType: spec.type,
          difficulty: spec.difficulty,
          targetNumber: spec.targetNumber,
          stem: c.stem,
          schemaValid: c.stem.length > 0 && !f.some((x) => x.startsWith("schema")),
          structurePreserved:
            !f.includes("target numeral absent") &&
            !f.some((x) => x.startsWith("stray numeral")) &&
            !f.includes("target outside difficulty band") &&
            !f.includes("exchange task does not force a carry"),
          literalCompliant: !f.some((x) => x.startsWith("banned")),
          accepted: c.accepted,
          stemWords: countWords(c.stem),
          attempts: outcome.attempts,
          latencyMs: outcome.latencyMs,
          failures: f,
        });
      }

      requestsByArm[arm].push({
        key: `${interest}:${spec.targetNumber}`,
        accepted: outcome.accepted.length > 0,
        attempts: outcome.attempts,
        latencyMs: outcome.latencyMs,
      });

      done += 1;
      process.stdout.write(
        `\r[${done}/${total}] ${arm} · ${interest} · ${spec.targetNumber} · ` +
          `${outcome.accepted.length}/${outcome.accepted.length + outcome.rejected.length} accepted   `
      );
    }
  }
}
process.stdout.write("\n\n");

const report: EvalReport = {
  ranAt: new Date().toISOString(),
  providerId: provider.id,
  model: provider.label,
  requests: total,
  batchSize: BATCH_SIZE,
  seedInterests: seedSample,
  novelInterests,
  arms: arms.map((arm) => summariseArm(arm, rows, requestsByArm[arm])),
  rows,
};

const dir = resolve(import.meta.dirname, "../eval");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, "results.json"), JSON.stringify(report, null, 2) + "\n");

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
for (const a of report.arms) {
  console.log(`${a.arm.padEnd(12)} candidates=${a.candidates}`);
  console.log(`  schema valid          ${pct(a.schemaValidRate)}`);
  console.log(`  structure preserved   ${pct(a.structurePreservedRate)}`);
  console.log(`  literal compliant     ${pct(a.literalCompliantRate)}`);
  console.log(`  accepted              ${pct(a.acceptRate)}`);
  console.log(`  fell back to cache    ${pct(a.fallbackRate)}`);
  console.log(`  attempts (mean)       ${a.meanAttempts.toFixed(2)}`);
  console.log(`  latency p50/p90       ${a.latencyMs.p50}ms / ${a.latencyMs.p90}ms`);
  if (a.topFailures.length) {
    console.log(`  top failures          ${a.topFailures.map((f) => `${f.reason} ×${f.count}`).join(", ")}`);
  }
  console.log();
}
console.log(`wrote ${resolve(dir, "results.json")} — view it at /eval`);
