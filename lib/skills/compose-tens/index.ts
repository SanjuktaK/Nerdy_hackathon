// ============================================================
// SKILL — Compose / decompose tens (G1, bead frame). SHIPS.
// Task type: EXCHANGE. The frame is pre-loaded; adding the addend
// overflows the ones rod and ten ones must become one ten.
// ============================================================

import {
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

export const COMPOSE_TENS_ID = "compose-tens";

/**
 * Build the exchange triple (startState, addend, target) so the carry is
 * forced by construction rather than by luck.
 *
 * Let r = target % 10. After the carry, start.ones + addend = r + 10, so
 *   start.ones = r + 10 − addend   (needs addend > r to stay a single digit)
 *   addend ≥ 10 − r                (so the ones rod actually overflows)
 * Both conditions are satisfied by addend = max(10 − r, r + 1), which exists
 * only for r in 1..8 — hence the target sets below never end in 0 or 9.
 */
export function exchangeTriple(target: number): {
  startState: BeadState;
  addend: number;
} {
  const r = target % 10;
  if (r === 0 || r === 9) {
    throw new Error(`compose-tens: target ${target} cannot force a single-digit carry`);
  }
  const addend = Math.max(10 - r, r + 1);
  const startOnes = r + 10 - addend;
  const startTens = Math.floor(target / 10) - 1;
  if (startTens < 0) {
    throw new Error(`compose-tens: target ${target} is too small to carry into`);
  }
  return { startState: { tens: startTens, ones: startOnes }, addend };
}

const TARGETS: Record<Difficulty, readonly number[]> = {
  1: [26, 34, 43, 52], // floor: this skill has no sub-exchange rung
  2: [26, 34, 43, 52],
  3: [34, 52, 63, 26],
  4: [44, 55, 77, 43],
  5: [41, 75, 87, 48, 62],
};

const FOCUS_TAGS: readonly string[] = [
  "ten ones become one ten",
  "the ten you traded has to land",
  "one ten bead is worth ten ones",
  "same skill, new surface",
];

const LADDER: readonly Difficulty[] = [3, 4, 5];

const clampToLadder = (d: Difficulty): Difficulty =>
  LADDER.includes(d) ? d : d < 3 ? 3 : 5;

export const composeTens: SkillModule<BeadState, BeadCode> = {
  id: COMPOSE_TENS_ID,
  band: "1",
  manipulative: "beadFrame",
  status: "SHIPS",
  title: "Compose and decompose tens",
  iepGoalTemplate:
    "When ten or more ones are on the frame, the learner will trade ten ones for one ten and state the new total in 4 of 5 opportunities.",

  emptyState: emptyBeadState,
  evaluate: beadValue,

  /** The frame is pre-loaded — the child starts from the addend already added. */
  initialState(task: Task): BeadState {
    const start = (task.startState as BeadState | undefined) ?? emptyBeadState();
    const addend = task.addend ?? 0;
    return { tens: start.tens, ones: start.ones + addend };
  },

  isAnswerable(state, task) {
    return beadValue(state) > 0 && state.ones !== this.initialState(task).ones;
  },

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
    return TARGETS[d].map((targetNumber) => {
      const { startState, addend } = exchangeTriple(targetNumber);
      return {
        skillId: COMPOSE_TENS_ID,
        type: "EXCHANGE",
        targetNumber,
        startState,
        addend,
        difficulty: d,
        focusTags: FOCUS_TAGS,
      };
    });
  },

  modelSteps(task: Task): ModelStep<BeadState>[] {
    const start = (task.startState as BeadState | undefined) ?? emptyBeadState();
    const addend = task.addend ?? 0;
    const loaded: BeadState = { tens: start.tens, ones: start.ones + addend };
    const done = canonicalState(task.targetNumber);
    return [
      {
        state: start,
        caption: `The frame holds ${beadValue(start)}.`,
      },
      {
        state: loaded,
        caption: `${addend} more ones join the right rod.`,
        slot: "ones",
      },
      {
        state: { tens: loaded.tens, ones: loaded.ones - 10 },
        caption: "Ten ones leave the right rod.",
        slot: "ones",
      },
      {
        state: done,
        caption: "One ten lands on the left rod.",
        slot: "tens",
      },
      {
        state: done,
        caption: `${done.tens} tens and ${done.ones} ones make ${task.targetNumber}.`,
      },
    ];
  },

  hintFor: beadHint,
  components: BEAD_COMPONENTS,
  spriteKeys: BEAD_SPRITE_KEYS,
};
