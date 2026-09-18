/**
 * Write the exact prompts the app sends, so the Python benchmark measures
 * production traffic rather than a toy prompt.
 *   node --import tsx scripts/mlx/bench-prompts.mts > .models/bench/prompts.json
 */
import { STEM_SYSTEM, stemUserPrompt } from "../../lib/ai/prompts";
import { BATCH_SIZE } from "../../lib/ai/generate";
import type { GenerationRequest } from "../../lib/ai/validate";
import { shippingSkills } from "../../lib/skills/registry";

const interests = ["trains", "washing machines", "dinosaurs"];

const out: { req: GenerationRequest; system: string; user: string }[] = [];
for (const skill of shippingSkills()) {
  for (const d of skill.ladder) {
    const spec = skill.taskSpace(d)[0];
    if (!spec) continue;
    const interest = interests[out.length % interests.length];
    const req: GenerationRequest = {
      skillId: spec.skillId,
      taskType: spec.type,
      targetNumber: spec.targetNumber,
      addend: spec.addend,
      difficulty: spec.difficulty,
      interest,
      allowedSpriteKeys: skill.spriteKeys,
    };
    out.push({ req, system: STEM_SYSTEM, user: stemUserPrompt(req, BATCH_SIZE) });
  }
}

process.stdout.write(JSON.stringify(out, null, 2));
