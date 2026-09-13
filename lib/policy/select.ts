// ============================================================
// §6.2 Next-task selection.
//
//   classify() → remediation[code] → taskSpace(difficulty) filtered by
//   focus → content lookup (§7) → Task
//
// Advancement is representation-first, then difficulty (§4).
// Selection is a pure function of (cursor, code, mastery, history).
// No randomness — rotation is indexed by history length.
// ============================================================

import { REPRESENTATIONS, type Difficulty, type Representation, type TaskSpec } from "../core/types";
import { stepDown, stepUp } from "../core/difficulty";
import { getSkill, shippingSkills } from "../skills/registry";
import type { AnySkillModule } from "../skills/types";
import { getCell, verdict, type MasteryState } from "./mastery";

export interface Cursor {
  skillId: string;
  difficulty: Difficulty;
  representation: Representation;
}

export interface Move {
  cursor: Cursor;
  /** What the next task should stress. Matched against TaskSpec.focusTags. */
  focus: string;
  /** Why the cursor moved. Shown in the caregiver app, never to the child. */
  reason:
    | "advance-representation"
    | "advance-difficulty"
    | "advance-skill"
    | "hold"
    | "step-back"
    | "remediate"
    | "ceiling";
}

const repIndex = (r: Representation) => REPRESENTATIONS.indexOf(r);

const clampToLadder = (skill: AnySkillModule, d: Difficulty): Difficulty => {
  if (skill.ladder.includes(d)) return d;
  const below = skill.ladder.filter((x) => x < d);
  if (below.length) return below[below.length - 1];
  return skill.ladder[0];
};

/**
 * The skill a focus tag belongs to. This is how NON_CANONICAL on a
 * place-value task routes the child into compose-tens: the focus
 * "ten ones become one ten" only exists in that module's task space.
 */
function skillForFocus(focus: string, fallbackSkillId: string): string {
  for (const skill of shippingSkills()) {
    for (const d of skill.ladder) {
      if (skill.taskSpace(d).some((s) => s.focusTags.includes(focus))) {
        return skill.id;
      }
    }
  }
  return fallbackSkillId;
}

/** The next shipping skill after this one, or null at the end of the list. */
function nextSkill(skillId: string): AnySkillModule | null {
  const list = shippingSkills();
  const i = list.findIndex((s) => s.id === skillId);
  return i >= 0 && i + 1 < list.length ? list[i + 1] : null;
}

/**
 * Resolve one classification into the next cursor.
 * `code` is the skill's own misconception code; the skill's remediation map
 * is the only thing consulted. L3 never reads a code's spelling.
 */
export function nextMove(
  cursor: Cursor,
  code: string,
  mastery: MasteryState
): Move {
  const skill = getSkill(cursor.skillId);
  const rem = skill.remediation[code] ?? skill.remediation["UNCLASSIFIED"];
  const focus = rem.focus;

  if (rem.nextDifficulty === "ADVANCE") {
    const cell = getCell(mastery, cursor.skillId, cursor.difficulty, cursor.representation);
    const v = verdict(cell);

    if (v === "STEP_BACK") {
      return {
        cursor: {
          ...cursor,
          difficulty: clampToLadder(skill, stepDown(cursor.difficulty)),
          representation: "C",
        },
        focus,
        reason: "step-back",
      };
    }
    if (v === "HOLD") return { cursor, focus, reason: "hold" };

    // Representation-first.
    const ri = repIndex(cursor.representation);
    if (ri < REPRESENTATIONS.length - 1) {
      return {
        cursor: { ...cursor, representation: REPRESENTATIONS[ri + 1] },
        focus,
        reason: "advance-representation",
      };
    }
    // Then difficulty, back to concrete.
    const up = stepUp(cursor.difficulty);
    if (skill.ladder.includes(up) && up !== cursor.difficulty) {
      return {
        cursor: { skillId: cursor.skillId, difficulty: up, representation: "C" },
        focus,
        reason: "advance-difficulty",
      };
    }
    // Then the next shipping skill.
    const nxt = nextSkill(cursor.skillId);
    if (nxt) {
      return {
        cursor: { skillId: nxt.id, difficulty: nxt.ladder[0], representation: "C" },
        focus: "same skill, new surface",
        reason: "advance-skill",
      };
    }
    return { cursor, focus, reason: "ceiling" };
  }

  if (rem.nextDifficulty === "HOLD") {
    return { cursor, focus, reason: "hold" };
  }

  // An explicit rung. The focus tag decides which module owns it.
  const targetSkillId = skillForFocus(focus, cursor.skillId);
  const targetSkill = getSkill(targetSkillId);
  const difficulty = clampToLadder(targetSkill, rem.nextDifficulty);
  // Dropping difficulty means dropping back to concrete; the child needs
  // something to hold, not a harder notation.
  const representation: Representation =
    targetSkillId !== cursor.skillId || difficulty < cursor.difficulty
      ? "C"
      : cursor.representation;

  return {
    cursor: { skillId: targetSkillId, difficulty, representation },
    focus,
    reason: "remediate",
  };
}

/**
 * Pick the structural task. Deterministic: among specs matching the focus,
 * rotate by `rotation` and skip anything in `recentTargets`.
 */
export function selectSpec(
  cursor: Cursor,
  focus: string,
  rotation: number,
  recentTargets: readonly number[] = []
): TaskSpec {
  const skill = getSkill(cursor.skillId);
  const all = skill.taskSpace(cursor.difficulty);
  if (all.length === 0) {
    throw new Error(`empty task space: ${cursor.skillId} @ ${cursor.difficulty}`);
  }

  const focused = all.filter((s) => s.focusTags.includes(focus));
  const pool = focused.length ? focused : all;

  const fresh = pool.filter((s) => !recentTargets.includes(s.targetNumber));
  const chooseFrom = fresh.length ? fresh : pool;

  return chooseFrom[Math.abs(rotation) % chooseFrom.length];
}

export const startingCursor = (): Cursor => ({
  skillId: shippingSkills()[0].id,
  difficulty: shippingSkills()[0].ladder[0],
  representation: "C",
});
