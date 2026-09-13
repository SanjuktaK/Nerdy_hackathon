// ============================================================
// §6.1 Mastery. Per (skill, difficulty, representation), a rolling
// window of the last 5 INDEPENDENT results.
//
//   Advance   — 4/5 correct AND no misconception twice
//   Hold      — otherwise
//   Step back — 3 consecutive same-code failures
//
// Nothing here samples. Same window in, same verdict out, always.
// ============================================================

import type { Difficulty, LearnerEvent, Representation } from "../core/types";
import { isCorrect } from "../core/types";

export const WINDOW = 5;
export const ADVANCE_CORRECT = 4;
export const STEP_BACK_RUN = 3;

export type MasteryKey = string;

export interface MasteryCell {
  skillId: string;
  difficulty: Difficulty;
  representation: Representation;
  /** Most recent last. Length ≤ WINDOW. */
  window: string[];
  /** Lifetime counters, kept for the caregiver view; not used by the verdict. */
  seen: number;
  correct: number;
}

export type MasteryState = Record<MasteryKey, MasteryCell>;

export const masteryKey = (
  skillId: string,
  difficulty: Difficulty,
  representation: Representation
): MasteryKey => `${skillId}|${difficulty}|${representation}`;

export const emptyMastery = (): MasteryState => ({});

export function getCell(
  state: MasteryState,
  skillId: string,
  difficulty: Difficulty,
  representation: Representation
): MasteryCell {
  const key = masteryKey(skillId, difficulty, representation);
  return (
    state[key] ?? {
      skillId,
      difficulty,
      representation,
      window: [],
      seen: 0,
      correct: 0,
    }
  );
}

/** Pure: returns a new MasteryState. Only INDEPENDENT events count. */
export function recordResult(
  state: MasteryState,
  ev: Pick<
    LearnerEvent,
    "skillId" | "difficulty" | "representation" | "result" | "phase"
  >
): MasteryState {
  if (ev.phase !== "INDEPENDENT") return state;
  const key = masteryKey(ev.skillId, ev.difficulty, ev.representation);
  const cell = getCell(state, ev.skillId, ev.difficulty, ev.representation);
  const window = [...cell.window, ev.result].slice(-WINDOW);
  return {
    ...state,
    [key]: {
      ...cell,
      window,
      seen: cell.seen + 1,
      correct: cell.correct + (isCorrect(ev.result) ? 1 : 0),
    },
  };
}

export type MasteryVerdict = "ADVANCE" | "HOLD" | "STEP_BACK";

export function verdict(cell: MasteryCell): MasteryVerdict {
  const w = cell.window;

  // Step back wins: a repeated identical failure is a stuck child, and the
  // fastest way out is easier ground, not another attempt at the same rung.
  if (w.length >= STEP_BACK_RUN) {
    const tail = w.slice(-STEP_BACK_RUN);
    if (!isCorrect(tail[0]) && tail.every((c) => c === tail[0])) return "STEP_BACK";
  }

  if (w.length < WINDOW) return "HOLD";

  const correct = w.filter(isCorrect).length;
  if (correct < ADVANCE_CORRECT) return "HOLD";

  const counts = new Map<string, number>();
  for (const c of w) {
    if (isCorrect(c)) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  for (const n of counts.values()) if (n >= 2) return "HOLD";

  return "ADVANCE";
}

export const cellAccuracy = (cell: MasteryCell): number =>
  cell.window.length === 0
    ? 0
    : cell.window.filter(isCorrect).length / cell.window.length;

/** Rebuild mastery from an event log. Used on load and by the caregiver export. */
export function replayMastery(events: readonly LearnerEvent[]): MasteryState {
  return events.reduce<MasteryState>((s, ev) => recordResult(s, ev), emptyMastery());
}
