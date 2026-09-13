// ============================================================
// §10 Eval harness — the shared result shape, so the runner and the
// page agree without the page importing the runner.
// ============================================================

import type { Difficulty } from "../core/types";

export type Arm = "naive" | "constrained";

export interface EvalRow {
  arm: Arm;
  interest: string;
  novel: boolean;
  skillId: string;
  taskType: string;
  difficulty: Difficulty;
  targetNumber: number;
  stem: string;
  schemaValid: boolean;
  /** Numeral present, no stray numeral, and on the rung the policy chose. */
  structurePreserved: boolean;
  /** Zero banned patterns. */
  literalCompliant: boolean;
  accepted: boolean;
  stemWords: number;
  attempts: number;
  latencyMs: number;
  failures: string[];
}

export interface ArmSummary {
  arm: Arm;
  candidates: number;
  schemaValidRate: number;
  structurePreservedRate: number;
  literalCompliantRate: number;
  acceptRate: number;
  /** Fraction of requests where no candidate survived and the cache covered. */
  fallbackRate: number;
  meanAttempts: number;
  latencyMs: { p50: number; p90: number; max: number };
  /** Accept rate per interest — does "washing machines" degrade vs "trains"? */
  byInterest: { interest: string; novel: boolean; acceptRate: number; literalRate: number }[];
  topFailures: { reason: string; count: number }[];
}

export interface EvalReport {
  ranAt: string;
  providerId: string;
  model: string;
  requests: number;
  batchSize: number;
  seedInterests: string[];
  novelInterests: string[];
  arms: ArmSummary[];
  rows: EvalRow[];
}
