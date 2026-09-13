// ============================================================
// Misconception taxonomy + classifier for the bead frame.
// Shared by place-value-99 (REPRESENT) and compose-tens (EXCHANGE).
//
// The product is this enum. Everything else is packaging.
// ============================================================

import {
  ONES_CAPACITY,
  beadValue,
  type BeadState,
} from "../core/bead-frame";
import type { Remediation, Task } from "../core/types";
import type { ComponentSpec, HintSpec } from "./types";

export type BeadCode =
  | "CORRECT"
  | "NON_CANONICAL" // right total, ones not exchanged (2 tens + 14 ones = 34)
  | "COLUMN_SWAP" // digits reversed across rods (4 tens + 3 ones for 34)
  | "COUNTING_ALL" // no place value at all; piling units onto the ones rod
  | "TENS_OMITTED" // handled the ones digit only
  | "ONES_OMITTED" // handled the tens digit only
  | "OFF_BY_ONE_ONES"
  | "OFF_BY_ONE_TENS"
  | "CARRY_DROPPED" // exchanged ten ones away but never added the ten
  | "UNCLASSIFIED";

export const BEAD_CODES: readonly BeadCode[] = [
  "CORRECT",
  "NON_CANONICAL",
  "COLUMN_SWAP",
  "COUNTING_ALL",
  "TENS_OMITTED",
  "ONES_OMITTED",
  "OFF_BY_ONE_ONES",
  "OFF_BY_ONE_TENS",
  "CARRY_DROPPED",
  "UNCLASSIFIED",
];

// NON_CANONICAL is the important one. The total is right, so a scoring app
// marks it wrong and moves on. It actually signals the child understands
// value but not exchange — which is a completely different next lesson
// from COLUMN_SWAP. This distinction is the demo.

/** Caregiver-facing plain English. No diagnostic vocabulary (§9.2). */
export const BEAD_CODE_LABEL: Record<BeadCode, string> = {
  CORRECT: "Correct",
  NON_CANONICAL: "Right amount, ten ones left untraded",
  COLUMN_SWAP: "Digits placed on the wrong rods",
  COUNTING_ALL: "Counted in ones, no tens used",
  TENS_OMITTED: "Ones placed, tens left empty",
  ONES_OMITTED: "Tens placed, ones left empty",
  OFF_BY_ONE_ONES: "One bead off in the ones",
  OFF_BY_ONE_TENS: "One bead off in the tens",
  CARRY_DROPPED: "Traded ten ones away, the new ten never landed",
  UNCLASSIFIED: "Not yet recognised",
};

// ---------- Classifier (deterministic — no LLM) ----------

export function classifyBeadState(state: BeadState, task: Task): BeadCode {
  const target = task.targetNumber;
  const t = Math.floor(target / 10);
  const o = target % 10;
  const total = beadValue(state);

  if (state.tens === t && state.ones === o) return "CORRECT";

  // Right value, wrong form. Check before the error cases.
  if (total === target && state.ones >= 10) return "NON_CANONICAL";

  if (task.type === "EXCHANGE" && total === target - 10 && state.ones < 10) {
    return "CARRY_DROPPED";
  }

  // Everything on the ones rod and nothing on the tens: the child is
  // counting in units. Saturating the rod (ONES_CAPACITY) is the clearest
  // case, but any double-digit pile with an empty tens rod is the same move.
  if (state.tens === 0 && state.ones >= 10 && target >= 20) return "COUNTING_ALL";
  if (state.ones === ONES_CAPACITY && state.tens === 0) return "COUNTING_ALL";

  if (t !== o && state.tens === o && state.ones === t) return "COLUMN_SWAP";

  if (state.tens === 0 && state.ones === o && t !== 0) return "TENS_OMITTED";
  if (state.tens === t && state.ones === 0 && o !== 0) return "ONES_OMITTED";

  if (state.tens === t && Math.abs(state.ones - o) === 1) return "OFF_BY_ONE_ONES";
  if (state.ones === o && Math.abs(state.tens - t) === 1) return "OFF_BY_ONE_TENS";

  return "UNCLASSIFIED";
}

// Order is load-bearing: NON_CANONICAL must be tested before the error
// branches, and COLUMN_SWAP is guarded on t !== o so that 44 doesn't
// register as a swap. Unit-tested in tests/classify.test.ts.

// ---------- Remediation policy ----------

export const BEAD_REMEDIATION: Record<BeadCode, Remediation> = {
  CORRECT: {
    nextDifficulty: "ADVANCE",
    focus: "same skill, new surface",
    explanationCue: "confirm and move on",
  },
  NON_CANONICAL: {
    nextDifficulty: 5,
    focus: "ten ones become one ten",
    explanationCue: "the amount is right; show the exchange",
  },
  COLUMN_SWAP: {
    nextDifficulty: 1,
    focus: "rod identity before rod contents",
    explanationCue: "name each rod, then place",
  },
  COUNTING_ALL: {
    nextDifficulty: 1,
    focus: "one ten bead is worth ten ones",
    explanationCue: "bundle before counting",
  },
  TENS_OMITTED: {
    nextDifficulty: 1,
    focus: "tens rod",
    explanationCue: "start on the left rod",
  },
  ONES_OMITTED: {
    nextDifficulty: 1,
    focus: "ones rod",
    explanationCue: "finish on the right rod",
  },
  OFF_BY_ONE_ONES: {
    nextDifficulty: "HOLD",
    focus: "recount ones",
    explanationCue: "count again, slowly",
  },
  OFF_BY_ONE_TENS: {
    nextDifficulty: "HOLD",
    focus: "recount tens",
    explanationCue: "count again, slowly",
  },
  CARRY_DROPPED: {
    nextDifficulty: 5,
    focus: "the ten you traded has to land",
    explanationCue: "where did the ten go",
  },
  UNCLASSIFIED: {
    nextDifficulty: 1,
    focus: "reset to known ground",
    explanationCue: "start simpler",
  },
};

// ---------- Child-facing wording ----------
// Literal, present tense, no negation, no praise inflation, no exclamation.
// These are the strings the FEEDBACK phase shows. Surface D (§9.4) may
// regenerate them shorter; the originals are always the fallback.

export const BEAD_CHILD_MESSAGE: Record<BeadCode, string> = {
  CORRECT: "That matches the number.",
  NON_CANONICAL: "The amount is right. Ten ones can become one ten.",
  COLUMN_SWAP: "The left rod holds tens. The right rod holds ones.",
  COUNTING_ALL: "One bead on the left rod is worth ten ones.",
  TENS_OMITTED: "The left rod is empty. Place the tens there.",
  ONES_OMITTED: "The right rod is empty. Place the ones there.",
  OFF_BY_ONE_ONES: "Count the right rod again, one bead at a time.",
  OFF_BY_ONE_TENS: "Count the left rod again, one bead at a time.",
  CARRY_DROPPED: "Ten ones left the right rod. One ten goes on the left rod.",
  UNCLASSIFIED: "Here is the same kind of number, made simpler.",
};

// ---------- Errorless retry hints (§4) ----------

export function beadHint(
  state: BeadState,
  task: Task,
  code: BeadCode
): HintSpec | null {
  const t = Math.floor(task.targetNumber / 10);
  const o = task.targetNumber % 10;

  switch (code) {
    case "CORRECT":
      return null;
    case "NON_CANONICAL":
    case "CARRY_DROPPED":
      return {
        slot: "ones",
        value: o,
        message: "Move ten ones off the right rod. Add one ten on the left rod.",
      };
    case "COLUMN_SWAP":
    case "COUNTING_ALL":
    case "TENS_OMITTED":
      return { slot: "tens", value: t, message: `The left rod holds ${t} tens.` };
    case "ONES_OMITTED":
      return { slot: "ones", value: o, message: `The right rod holds ${o} ones.` };
    case "OFF_BY_ONE_ONES":
      return { slot: "ones", value: o, message: `The right rod holds ${o} ones.` };
    case "OFF_BY_ONE_TENS":
      return { slot: "tens", value: t, message: `The left rod holds ${t} tens.` };
    default:
      return state.tens === t
        ? { slot: "ones", value: o, message: `The right rod holds ${o} ones.` }
        : { slot: "tens", value: t, message: `The left rod holds ${t} tens.` };
  }
}

// ---------- Component profile derivation (§6.3) ----------

export const BEAD_COMPONENTS: readonly ComponentSpec<BeadCode>[] = [
  {
    id: "placeValue",
    label: "Reading a number by its rods",
    penalisedBy: ["COLUMN_SWAP", "TENS_OMITTED", "ONES_OMITTED", "COUNTING_ALL"],
  },
  {
    id: "exchange",
    label: "Trading ten ones for one ten",
    penalisedBy: ["NON_CANONICAL", "CARRY_DROPPED"],
  },
  {
    id: "counting",
    label: "Counting beads accurately",
    penalisedBy: ["OFF_BY_ONE_ONES", "OFF_BY_ONE_TENS"],
  },
];

/** Sprite keys any bead-frame skill may use. The validator enforces membership. */
export const BEAD_SPRITE_KEYS = [
  "group-a",
  "group-b",
  "container",
  "row",
  "single",
] as const;
