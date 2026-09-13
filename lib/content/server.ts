// ============================================================
// §7 request path, server side. Route handlers and the offline
// scripts both come through here.
// ============================================================

import { generateValidated, BATCH_SIZE } from "../ai/generate";
import { getSkill } from "../skills/registry";
import type { Difficulty, StemSource, TaskSpec } from "../core/types";
import { lookup, nearestTheme, writeStems } from "./cache";
import type { StemEntry } from "./schema";
import { normaliseInterest } from "../theme";

export interface StemRequest {
  skillId: string;
  taskType: string;
  difficulty: Difficulty;
  targetNumber: number;
  addend?: number;
  interest: string;
  rotation?: number;
}

export interface StemResponse {
  stem: string;
  spriteKey: string;
  source: StemSource;
  /** Populated only when generation ran. Surfaced in the caregiver app. */
  diagnostics?: {
    attempts: number;
    latencyMs: number;
    accepted: number;
    rejected: number;
    providerId: string;
    rejections: string[];
  };
}

export const specToRequest = (spec: TaskSpec, interest: string, rotation = 0): StemRequest => ({
  skillId: spec.skillId,
  taskType: spec.type,
  difficulty: spec.difficulty,
  targetNumber: spec.targetNumber,
  addend: spec.addend,
  interest,
  rotation,
});

/**
 * Cache hit → instant, zero cost. Miss → one batch of 5 through the
 * validator. Two failed attempts or a dead provider → nearest cached
 * theme, silently, because a child waiting on a retry loop is a worse
 * outcome than a child seeing trains instead of washing machines.
 */
export async function requestStem(req: StemRequest): Promise<StemResponse> {
  const interest = normaliseInterest(req.interest);
  const q = { ...req, interest };

  const hit = lookup(q);
  if (hit) {
    return { stem: hit.entry.stem, spriteKey: hit.entry.spriteKey, source: "cache" };
  }

  const skill = getSkill(req.skillId);
  const outcome = await generateValidated(
    {
      skillId: req.skillId,
      taskType: req.taskType,
      targetNumber: req.targetNumber,
      addend: req.addend,
      difficulty: req.difficulty,
      interest,
      allowedSpriteKeys: skill.spriteKeys,
    },
    { count: BATCH_SIZE }
  );

  const diagnostics = {
    attempts: outcome.attempts,
    latencyMs: outcome.latencyMs,
    accepted: outcome.accepted.length,
    rejected: outcome.rejected.length,
    providerId: outcome.providerId,
    rejections: outcome.rejected.flatMap((r) => r.failures).slice(0, 12),
  };

  if (outcome.accepted.length > 0) {
    const entries: StemEntry[] = outcome.accepted.map((g) => ({
      skillId: req.skillId,
      taskType: req.taskType,
      difficulty: req.difficulty,
      targetNumber: req.targetNumber,
      addend: req.addend,
      interest,
      stem: g.stem,
      spriteKey: g.spriteKey,
      source: "generated",
    }));
    writeStems(entries);
    const chosen = entries[Math.abs(req.rotation ?? 0) % entries.length];
    return {
      stem: chosen.stem,
      spriteKey: chosen.spriteKey,
      source: "generated",
      diagnostics,
    };
  }

  const near = nearestTheme(q);
  if (near) {
    return {
      stem: near.entry.stem,
      spriteKey: near.entry.spriteKey,
      source: "fallback",
      diagnostics,
    };
  }

  // Unreachable for a shipping skill — the seed bank covers every rung.
  return {
    stem: `Show ${req.targetNumber}.`,
    spriteKey: skill.spriteKeys[0],
    source: "fallback",
    diagnostics,
  };
}

/** The whole batch, for the offline warm-up run (§13, day 14). */
export async function warmInterest(
  interest: string,
  onProgress?: (done: number, total: number) => void
): Promise<StemEntry[]> {
  const { shippingSkills } = await import("../skills/registry");
  const specs: TaskSpec[] = [];
  for (const skill of shippingSkills()) {
    for (const d of skill.ladder) specs.push(...skill.taskSpace(d));
  }
  const out: StemEntry[] = [];
  let done = 0;
  for (const spec of specs) {
    const res = await requestStem(specToRequest(spec, interest));
    if (res.source === "generated") {
      out.push({
        skillId: spec.skillId,
        taskType: spec.type,
        difficulty: spec.difficulty,
        targetNumber: spec.targetNumber,
        addend: spec.addend,
        interest: normaliseInterest(interest),
        stem: res.stem,
        spriteKey: res.spriteKey,
        source: "generated",
      });
    }
    onProgress?.(++done, specs.length);
  }
  return out;
}
