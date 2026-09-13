// ============================================================
// SKILL — Place value to 99 (G1, bead frame). SHIPS.
// Task type: REPRESENT. "Show 34."
// ============================================================

import {
  TENS_CAPACITY,
  ONES_CAPACITY,
  beadValue,
  canonicalState,
  emptyBeadState,
  type BeadState,
} from "../../core/bead-frame";
import type { Difficulty, Task, TaskSpec } from "../../core/types";
import { inBand } from "../../core/difficulty";
import {
  BEAD_CHILD_MESSAGE,
  BEAD_CODES,
  BEAD_COMPONENTS,
  BEAD_REMEDIATION,
  BEAD_SPRITE_KEYS,
  beadHint,
  classifyBeadState,
  type BeadCode,
} from "../bead-common";
import type { ModelStep, SkillModule } from "../types";
import {
  BeadFrameAbstract,
  BeadFrameConcrete,
  BeadFrameRepresentational,
} from "@/components/manipulatives/BeadFrame";

export const PLACE_VALUE_ID = "place-value-99";

/**
 * Targets are sampled, not enumerated, and the sample is fixed. The warm
 * cache (§7) is pre-generated over exactly this set, which is what makes a
 * seed-interest session a 100% cache hit and 0 model calls.
 */
const TARGETS: Record<Difficulty, readonly number[]> = {
  1: [20, 30, 40, 50, 60, 70],
  2: [12, 13, 14, 16, 17, 18],
  3: [34, 62, 27, 58, 41, 76],
  4: [44, 55, 66, 77, 43, 34],
  5: [44, 55, 66, 77, 43, 34], // ceiling: this skill has no exchange rung
};

const FOCUS_TAGS: Record<Difficulty, readonly string[]> = {
  1: ["tens rod", "rod identity before rod contents", "one ten bead is worth ten ones", "reset to known ground"],
  2: ["ones rod", "recount ones", "rod identity before rod contents"],
  3: ["tens rod", "ones rod", "recount ones", "recount tens", "same skill, new surface"],
  4: ["rod identity before rod contents", "recount tens", "recount ones"],
  5: ["rod identity before rod contents"],
};

const LADDER: readonly Difficulty[] = [1, 2, 3, 4];

const clampToLadder = (d: Difficulty): Difficulty =>
  LADDER.includes(d) ? d : (LADDER[LADDER.length - 1] as Difficulty);

export const placeValue99: SkillModule<BeadState, BeadCode> = {
  id: PLACE_VALUE_ID,
  band: "1",
  manipulative: "beadFrame",
  status: "SHIPS",
  title: "Place value to 99",
  iepGoalTemplate:
    "Given a two-digit number, the learner will build it on a tens-and-ones frame with the correct number of tens and ones in 4 of 5 opportunities.",

  emptyState: emptyBeadState,
  evaluate: beadValue,

  initialState: () => emptyBeadState(),
  isAnswerable: (state) => beadValue(state) > 0,

  classify: classifyBeadState,
  codes: BEAD_CODES,
  remediation: BEAD_REMEDIATION,
  childMessage: BEAD_CHILD_MESSAGE,

  render: {
    concrete: BeadFrameConcrete,
    representational: BeadFrameRepresentational,
    abstract: BeadFrameAbstract,
  },

  ladder: LADDER,
  inBand,

  taskSpace(difficulty: Difficulty): TaskSpec[] {
    const d = clampToLadder(difficulty);
    return TARGETS[d].map((targetNumber) => ({
      skillId: PLACE_VALUE_ID,
      type: "REPRESENT",
      targetNumber,
      difficulty: d,
      focusTags: FOCUS_TAGS[d],
    }));
  },

  modelSteps(task: Task): ModelStep<BeadState>[] {
    const { tens, ones } = canonicalState(task.targetNumber);
    const steps: ModelStep<BeadState>[] = [
      { state: emptyBeadState(), caption: "The frame starts empty." },
    ];
    if (tens > 0) {
      steps.push({
        state: { tens, ones: 0 },
        caption: `${task.targetNumber} has ${tens} tens. The left rod holds ${tens}.`,
        slot: "tens",
      });
    }
    steps.push({
      state: { tens, ones },
      caption: `${task.targetNumber} has ${ones} ones. The right rod holds ${ones}.`,
      slot: "ones",
    });
    steps.push({
      state: { tens, ones },
      caption: `${tens} tens and ${ones} ones make ${task.targetNumber}.`,
    });
    return steps;
  },

  hintFor: beadHint,
  components: BEAD_COMPONENTS,
  spriteKeys: BEAD_SPRITE_KEYS,
};

export { TENS_CAPACITY, ONES_CAPACITY };
