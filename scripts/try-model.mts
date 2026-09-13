#!/usr/bin/env -S npx tsx
/**
 * A one-shot check that the resolved provider can actually serve a child.
 *   npm run try:model -- --interest "washing machines" --target 34
 */
import { resolveProvider } from "../lib/ai/provider";
import { generateValidated } from "../lib/ai/generate";
import { getSkill } from "../lib/skills/registry";
import type { Difficulty } from "../lib/core/types";

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1] ?? "");
}
const interest = args.get("interest") ?? "washing machines";
const targetNumber = Number(args.get("target") ?? 34);
const difficulty = Number(args.get("difficulty") ?? 3) as Difficulty;

const provider = await resolveProvider();
console.log(`provider: ${provider.label}\n`);
if (provider.id === "none") {
  console.error("No model resolved. Check OLLAMA_MODEL against `ollama list`.");
  process.exit(1);
}

const skill = getSkill("place-value-99");
const out = await generateValidated(
  {
    skillId: skill.id,
    taskType: "REPRESENT",
    targetNumber,
    difficulty,
    interest,
    allowedSpriteKeys: skill.spriteKeys,
  },
  { provider }
);

console.log(
  `"${interest}" + ${targetNumber} → ${out.accepted.length} accepted, ` +
    `${out.rejected.length} rejected, ${out.attempts} attempt(s), ${out.latencyMs}ms\n`
);
if (out.error) console.log(`  provider error: ${out.error}\n`);
for (const a of out.accepted) console.log(`  PASS  "${a.stem}"  [${a.spriteKey}]`);
for (const r of out.rejected) {
  console.log(`  FAIL  "${r.stem}"`);
  console.log(`          ${r.failures.join(", ")}`);
}
