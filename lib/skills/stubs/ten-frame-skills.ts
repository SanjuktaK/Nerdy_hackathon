// ============================================================
// STUB SKILLS — real modules, narrow content.
// They exist to prove the §5 interface is not bead-frame-shaped.
// Neither is on the ship list; both are reachable from the caregiver app.
// ============================================================

import {
  TEN_FRAME_CAPACITY,
  emptyTenFrame,
  tenFrameValue,
  type TenFrameState,
} from "../../core/ten-frame";
import type { Difficulty, Remediation, Task, TaskSpec } from "../../core/types";
import type { ComponentSpec, ModelStep, SkillModule } from "../types";
import {
  TenFrameAbstract,
  TenFrameConcrete,
  TenFrameRepresentational,
} from "@/components/manipulatives/TenFrame";

export type TenFrameCode =
  | "CORRECT"
  | "OFF_BY_ONE"
  | "OVERCOUNT"
  | "UNDERCOUNT"
  | "ADDEND_ONLY" // placed one addend, never added the second
  | "UNCLASSIFIED";

const CODES: readonly TenFrameCode[] = [
  "CORRECT",
  "OFF_BY_ONE",
  "OVERCOUNT",
  "UNDERCOUNT",
  "ADDEND_ONLY",
  "UNCLASSIFIED",
];

const REMEDIATION: Record<TenFrameCode, Remediation> = {
  CORRECT: { nextDifficulty: "ADVANCE", focus: "same skill, new surface", explanationCue: "confirm and move on" },
  OFF_BY_ONE: { nextDifficulty: "HOLD", focus: "recount", explanationCue: "count again, slowly" },
  OVERCOUNT: { nextDifficulty: 1, focus: "stop at the number", explanationCue: "the last counter names the set" },
  UNDERCOUNT: { nextDifficulty: 1, focus: "fill every cell", explanationCue: "one counter per cell" },
  ADDEND_ONLY: { nextDifficulty: 2, focus: "add the second group", explanationCue: "both groups join" },
  UNCLASSIFIED: { nextDifficulty: 1, focus: "reset to known ground", explanationCue: "start simpler" },
};

const CHILD_MESSAGE: Record<TenFrameCode, string> = {
  CORRECT: "That matches the number.",
  OFF_BY_ONE: "Count the counters again, one at a time.",
  OVERCOUNT: "There are more counters than the number.",
  UNDERCOUNT: "There are fewer counters than the number.",
  ADDEND_ONLY: "One group is placed. The second group joins it.",
  UNCLASSIFIED: "Here is the same kind of number, made simpler.",
};

const COMPONENTS: readonly ComponentSpec<TenFrameCode>[] = [
  { id: "counting", label: "Counting accurately", penalisedBy: ["OFF_BY_ONE", "OVERCOUNT", "UNDERCOUNT"] },
  { id: "placeValue", label: "Holding a total while adding", penalisedBy: ["ADDEND_ONLY"] },
];

const SPRITE_KEYS = ["group-a", "group-b", "container", "row", "single"] as const;

function classifyTenFrame(state: TenFrameState, task: Task): TenFrameCode {
  const v = tenFrameValue(state);
  const target = task.targetNumber;
  if (v === target) return "CORRECT";
  if (task.type === "ADD" && task.addend !== undefined && v === target - task.addend) {
    return "ADDEND_ONLY";
  }
  if (Math.abs(v - target) === 1) return "OFF_BY_ONE";
  if (v > target) return "OVERCOUNT";
  if (v > 0) return "UNDERCOUNT";
  return "UNCLASSIFIED";
}

const base = {
  band: "K" as const,
  manipulative: "tenFrame" as const,
  status: "STUB" as const,
  emptyState: emptyTenFrame,
  evaluate: tenFrameValue,
  classify: classifyTenFrame,
  codes: CODES,
  remediation: REMEDIATION,
  childMessage: CHILD_MESSAGE,
  render: {
    concrete: TenFrameConcrete,
    representational: TenFrameRepresentational,
    abstract: TenFrameAbstract,
  },
  hintFor: (_s: TenFrameState, task: Task) => ({
    slot: "frame",
    value: task.targetNumber,
    message: `The frame holds ${task.targetNumber} counters.`,
  }),
  components: COMPONENTS,
  spriteKeys: SPRITE_KEYS,
  /** Ten-frame rungs are bounded ranges, not digit shapes. */
  inBand: (d: Difficulty, n: number) => n >= 0 && n <= TEN_FRAME_CAPACITY && n >= (d - 1) * 4,
};

// ---------- K — counting & cardinality to 20 ----------

const COUNT_TARGETS: Record<Difficulty, readonly number[]> = {
  1: [3, 4, 5, 6],
  2: [7, 8, 9, 10],
  3: [11, 12, 13, 14],
  4: [15, 16, 17, 18],
  5: [19, 20, 17, 13],
};

export const countingTo20: SkillModule<TenFrameState, TenFrameCode> = {
  ...base,
  id: "counting-20",
  title: "Counting and cardinality to 20",
  iepGoalTemplate:
    "Given a number to 20, the learner will place that many counters on a ten-frame in 4 of 5 opportunities.",
  initialState: () => emptyTenFrame(),
  isAnswerable: (s) => s.filled > 0,
  ladder: [1, 2, 3, 4, 5] as const,
  taskSpace(difficulty: Difficulty): TaskSpec[] {
    return COUNT_TARGETS[difficulty].map((targetNumber) => ({
      skillId: "counting-20",
      type: "REPRESENT",
      targetNumber,
      difficulty,
      focusTags: ["recount", "stop at the number", "fill every cell", "reset to known ground", "same skill, new surface"],
    }));
  },
  modelSteps(task: Task): ModelStep<TenFrameState>[] {
    return [
      { state: emptyTenFrame(), caption: "The frame starts empty." },
      {
        state: { filled: Math.min(task.targetNumber, TEN_FRAME_CAPACITY) },
        caption: `${task.targetNumber} counters fill the frame in order.`,
        slot: "frame",
      },
    ];
  },
};

// ---------- G1 — add / subtract within 20 ----------

const ADD_PAIRS: Record<Difficulty, readonly [number, number][]> = {
  1: [[2, 3], [3, 4], [1, 5], [4, 2]],
  2: [[5, 3], [4, 5], [6, 3], [2, 7]],
  3: [[7, 5], [8, 4], [6, 6], [9, 3]],
  4: [[8, 7], [9, 6], [7, 8], [9, 9]],
  5: [[9, 8], [8, 9], [9, 7], [6, 9]],
};

export const addSubWithin20: SkillModule<TenFrameState, TenFrameCode> = {
  ...base,
  id: "add-sub-20",
  band: "1",
  title: "Add and subtract within 20",
  iepGoalTemplate:
    "Given two groups totalling 20 or less, the learner will build the total on a ten-frame in 4 of 5 opportunities.",
  initialState: (task: Task) => ({
    filled: (task.startState as TenFrameState | undefined)?.filled ?? 0,
  }),
  isAnswerable: (s, task) =>
    s.filled !== ((task.startState as TenFrameState | undefined)?.filled ?? 0),
  ladder: [1, 2, 3, 4, 5] as const,
  taskSpace(difficulty: Difficulty): TaskSpec[] {
    return ADD_PAIRS[difficulty].map(([a, b]) => ({
      skillId: "add-sub-20",
      type: "ADD",
      targetNumber: a + b,
      startState: { filled: a },
      addend: b,
      difficulty,
      focusTags: ["add the second group", "recount", "reset to known ground", "same skill, new surface"],
    }));
  },
  modelSteps(task: Task): ModelStep<TenFrameState>[] {
    const a = (task.startState as TenFrameState | undefined)?.filled ?? 0;
    return [
      { state: { filled: a }, caption: `The frame holds ${a} counters.` },
      {
        state: { filled: task.targetNumber },
        caption: `${task.addend} more counters join them.`,
        slot: "frame",
      },
      { state: { filled: task.targetNumber }, caption: `The total is ${task.targetNumber}.` },
    ];
  },
};
