// ============================================================
// DEPRECATED — kept as a re-export so the day-11 "types locked"
// surface still resolves. The definitions moved to their layers:
//
//   bead frame domain   → lib/core/bead-frame.ts
//   difficulty ladder   → lib/core/difficulty.ts
//   taxonomy/classifier → lib/skills/bead-common.ts
//   generation contract → lib/ai/validate.ts
//   eval metrics        → lib/eval/types.ts
//
// Import from those directly in new code.
// ============================================================

export {
  TENS_CAPACITY,
  ONES_CAPACITY,
  beadValue,
  type BeadState,
} from "./core/bead-frame";

export { DIFFICULTY_BANDS } from "./core/difficulty";

export type { Difficulty, Task } from "./core/types";

export {
  classifyBeadState as classify,
  BEAD_REMEDIATION as REMEDIATION,
  type BeadCode as Misconception,
} from "./skills/bead-common";

export type { Remediation } from "./core/types";

export {
  GENERATED_STEM_SCHEMA,
  MAX_STEM_WORDS,
  validateStem,
  type GeneratedStem,
  type GenerationRequest,
  type ValidationResult,
} from "./ai/validate";

export type { EvalRow } from "./eval/types";
