// ============================================================
// §7 Warm-cache format. stems.json is committed to the repo and is
// what makes normal operation cost zero model calls and zero latency.
// ============================================================

import type { Difficulty, StemSource } from "../core/types";

export interface StemEntry {
  skillId: string;
  taskType: string;
  difficulty: Difficulty;
  targetNumber: number;
  addend?: number;
  interest: string;
  stem: string;
  spriteKey: string;
  source: StemSource;
}

export interface StemBank {
  version: number;
  generatedAt: string;
  /** "template" for the committed seed bank, or the model id for a batch run. */
  producedBy: string;
  entries: StemEntry[];
}

export const stemKey = (
  skillId: string,
  taskType: string,
  difficulty: Difficulty,
  targetNumber: number,
  interest: string
): string =>
  `${skillId}|${taskType}|${difficulty}|${targetNumber}|${interest.trim().toLowerCase()}`;

export const entryKey = (e: StemEntry): string =>
  stemKey(e.skillId, e.taskType, e.difficulty, e.targetNumber, e.interest);
