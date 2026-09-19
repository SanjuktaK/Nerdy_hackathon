// ============================================================
// The planner's rules.
//
// Two jobs:
//   1. rulePlan — a complete, deterministic planner. It is what runs when
//      no model is reachable, and it is good enough to demo on its own.
//   2. planOptions — the menu the model chooses the next question from.
//      Only safe steps are on it: nothing harder straight after a miss, at
//      most one level up, and review only after a slip. The model steers;
//      it cannot drive off the road.
// ============================================================

import { PREREQUISITE, REP_LABEL, REP_LADDER, clampLevel, gradeInfo } from "./curriculum";
import { MISTAKE_TEXT } from "./diagnose";
import type { Attempt, ChildProfile, LearnerModel, Level, Plan, Rep, SkillId } from "./types";

/** Two first-try answers in a row at this level or above → the next skill. */
export const MOVE_ON_LEVEL = 4;

/** Where a new child starts, before any answers. */
export function startingLevel(profile: ChildProfile): Level {
  return profile.support === "lots" ? 1 : profile.support === "some" ? 2 : 3;
}

export function initialModel(profile: ChildProfile): LearnerModel {
  const lvl = startingLevel(profile);
  const levels: LearnerModel["levels"] = {};
  for (const s of gradeInfo(profile.grade).skills) levels[s] = lvl;
  return {
    levels,
    strengths: [],
    workingOn: [],
    note: "No sessions yet.",
    sessions: 0,
    updatedAt: Date.now(),
    source: "initial",
  };
}

const levelOf = (model: LearnerModel, skill: SkillId, fallback: Level): Level =>
  model.levels[skill] ?? fallback;

/**
 * The next question, from rules alone.
 *   · first question: the band's first skill the child is least sure of
 *   · right: stay on the skill, one level up (after two in a row), else same
 *   · wrong: same skill, one level down; at level 1, step back to the prerequisite
 *   · adaptation off: fixed rotation through the band at the starting level
 */
export function rulePlan(
  profile: ChildProfile,
  model: LearnerModel,
  history: Attempt[]
): Plan {
  const band = gradeInfo(profile.grade).skills;
  const start = startingLevel(profile);
  const last = history[history.length - 1];

  if (!profile.adaptConsent) {
    const skill = band[history.length % band.length];
    return { skill, level: start, focus: "practice", source: "rules", reason: "Adaptation is off: fixed order." };
  }

  if (!last) {
    const skill = [...band].sort((a, b) => levelOf(model, a, start) - levelOf(model, b, start))[0];
    return {
      skill,
      level: levelOf(model, skill, start),
      focus: "warm up",
      source: "rules",
      reason: "First question: the skill with the lowest comfortable level.",
    };
  }

  if (!last.correct) {
    if (last.level > 1) {
      return {
        skill: last.skill,
        level: clampLevel(last.level - 1),
        focus: MISTAKE_TEXT[last.mistake],
        source: "rules",
        reason: `Wrong at level ${last.level} (${last.mistake}): one level easier, same skill.`,
      };
    }
    const back = PREREQUISITE[last.skill];
    if (back) {
      return {
        skill: back,
        level: 2,
        focus: "the step underneath",
        source: "rules",
        reason: `Wrong at level 1: step back to ${back}.`,
      };
    }
    return { skill: last.skill, level: 1, focus: "try again, gently", source: "rules", reason: "Already at the easiest level." };
  }

  if (last.tries > 1 && band.includes(last.skill)) {
    // Solved on the second try: right, but not yet easy. Hold the level.
    return {
      skill: last.skill,
      level: last.level,
      focus: MISTAKE_TEXT[last.mistake],
      source: "rules",
      reason: `Solved on try ${last.tries} after "${last.mistake}": same level again.`,
    };
  }

  const prev = history[history.length - 2];
  const twoRight =
    !!prev && prev.correct && prev.tries === 1 && prev.skill === last.skill && prev.level === last.level;
  // First time through a skill, move on once it is solid at level 4; on a
  // later lap (it was already saved at 4+), finish it at level 5.
  const firstLap = (model.levels[last.skill] ?? 0) < MOVE_ON_LEVEL;
  if (twoRight && (last.level === 5 || (firstLap && last.level >= MOVE_ON_LEVEL))) {
    // Solid here: move to the next skill in the band.
    const i = band.indexOf(last.skill);
    const next = band[(i + 1) % band.length] ?? band[0];
    return {
      skill: next,
      level: levelOf(model, next, start),
      focus: "something new",
      source: "rules",
      reason: `Two right at level ${last.level}: move on to ${next}.`,
    };
  }
  // If this was a step back to a prerequisite, a right answer returns to the band.
  if (!band.includes(last.skill)) {
    const up = band.find((s) => PREREQUISITE[s] === last.skill) ?? band[0];
    return { skill: up, level: 1, focus: "back to the main skill", source: "rules", reason: `Solid on ${last.skill}: back to ${up}.` };
  }
  return {
    skill: last.skill,
    level: twoRight ? clampLevel(last.level + 1) : last.level,
    focus: twoRight ? "a little harder" : "one more like that",
    source: "rules",
    reason: twoRight ? "Two right in a row: one level harder." : "Right once: same level to confirm.",
  };
}

/** The deterministic learner-model update, used without a model or without consent. */
export function ruleReview(model: LearnerModel, attempts: Attempt[]): LearnerModel {
  const levels = { ...model.levels };
  const bySkill = new Map<SkillId, Attempt[]>();
  for (const a of attempts) bySkill.set(a.skill, [...(bySkill.get(a.skill) ?? []), a]);

  const strengths: SkillId[] = [];
  const workingOn: SkillId[] = [];
  for (const [skill, as] of bySkill) {
    const clean = as.filter((a) => a.correct && a.tries === 1);
    const missed = as.filter((a) => !a.correct);
    const shaky = as.filter((a) => a.correct && a.tries > 1);
    if (clean.length === as.length) {
      // Every one right first time: comfortable at the highest level seen.
      levels[skill] = clampLevel(Math.max(levels[skill] ?? 1, ...clean.map((a) => a.level)));
      strengths.push(skill);
    } else if (missed.length) {
      // A miss: comfortable one level below the easiest miss.
      levels[skill] = clampLevel(Math.min(...missed.map((a) => a.level)) - 1);
      workingOn.push(skill);
    } else {
      // Solved, but on a second try: comfortable at the easiest such level.
      levels[skill] = clampLevel(Math.min(...shaky.map((a) => a.level)));
      workingOn.push(skill);
    }
  }
  // The most abstract way each skill was solved first time is where it resumes.
  const reps: LearnerModel["reps"] = { ...(model.reps ?? {}) };
  for (const [skill, as] of bySkill) {
    const ladder = REP_LADDER[skill];
    if (!ladder) continue;
    const cleanReps = as.filter((a) => a.correct && a.tries === 1).map((a) => REP_ORDER.indexOf(a.rep ?? "C"));
    const missReps = as.filter((a) => !a.correct).map((a) => REP_ORDER.indexOf(a.rep ?? "C"));
    if (cleanReps.length) reps[skill] = REP_ORDER[Math.max(...cleanReps)];
    else if (missReps.length) reps[skill] = REP_ORDER[Math.max(0, Math.min(...missReps) - 1)];
  }

  const right = attempts.filter((a) => a.correct).length;
  return {
    reps,
    levels,
    strengths,
    workingOn,
    note: `${right} of ${attempts.length} solved this session.`,
    sessions: model.sessions + 1,
    updatedAt: Date.now(),
    source: "rules",
  };
}

// ============================================================
// The menu the model chooses from.
//
// The model decides the next question. What it cannot do is pick a step
// that is unsafe for this child, so the menu only ever contains safe ones:
// nothing harder straight after a miss, never more than one level up, and
// review from the band below only after a slip. Everything else — hold,
// push, switch skill, go back — is the model's call.
// ============================================================

export interface PlanOption {
  skill: SkillId;
  level: Level;
  kind: "harder" | "same" | "easier" | "switch" | "review" | "start" | "abstract" | "concrete";
  label: string;
  rep: Rep;
}

const REP_ORDER: Rep[] = ["C", "R", "A"];

/** The way a skill is currently being shown: its last use, else the saved one, else pictures. */
function currentRep(skill: SkillId, model: LearnerModel, history: Attempt[]): Rep {
  const ladder = REP_LADDER[skill];
  if (!ladder) return "C";
  const last = [...history].reverse().find((a) => a.skill === skill);
  const r = last?.rep ?? model.reps?.[skill] ?? "C";
  return ladder.includes(r) ? r : "C";
}

export interface SkillStats {
  skill: SkillId;
  saved_level: Level;
  answered: number;
  right_first_try: number;
  right_first_try_in_a_row: number;
  last_level?: Level;
}

export function skillStats(profile: ChildProfile, model: LearnerModel, history: Attempt[]): SkillStats[] {
  const start = startingLevel(profile);
  const skills = [...new Set([...gradeInfo(profile.grade).skills, ...history.map((a) => a.skill)])];
  return skills.map((skill) => {
    const as = history.filter((a) => a.skill === skill);
    let streak = 0;
    for (let i = as.length - 1; i >= 0 && as[i].correct && as[i].tries === 1; i--) streak++;
    return {
      skill,
      saved_level: model.levels[skill] ?? start,
      answered: as.length,
      right_first_try: as.filter((a) => a.correct && a.tries === 1).length,
      right_first_try_in_a_row: streak,
      last_level: as[as.length - 1]?.level,
    };
  });
}

export function planOptions(profile: ChildProfile, model: LearnerModel, history: Attempt[]): PlanOption[] {
  const band = gradeInfo(profile.grade).skills;
  const start = startingLevel(profile);
  const saved = (s: SkillId) => model.levels[s] ?? start;
  const last = history[history.length - 1];
  const opts: PlanOption[] = [];
  const add = (skill: SkillId, level: number, kind: PlanOption["kind"], why: string, rep = currentRep(skill, model, history)) => {
    const l = clampLevel(level);
    if (opts.some((o) => o.skill === skill && o.level === l && o.rep === rep)) return;
    const shown = REP_LADDER[skill] ? `, shown as ${REP_LABEL[rep]}` : "";
    opts.push({ skill, level: l, kind, label: `${skill} at level ${l}${shown} (${why})`, rep });
  };

  if (!last) {
    for (const s of band) add(s, saved(s), "start", "its saved level");
    return opts;
  }

  const S = last.skill;
  const L = last.level;
  const clean = last.correct && last.tries === 1;
  const shaky = last.correct && last.tries > 1;
  // Pictures → dots → numbers: a step on this ladder is a choice too.
  const ladder = REP_LADDER[S];
  const R = currentRep(S, model, history);
  const ri = ladder ? ladder.indexOf(R) : -1;
  if (ladder && clean && ri < ladder.length - 1) add(S, L, "abstract", `the same, now as ${REP_LABEL[ladder[ri + 1]]}`, ladder[ri + 1]);
  if (ladder && !clean && ri > 0) add(S, L, "concrete", `the same, back to ${REP_LABEL[ladder[ri - 1]]}`, ladder[ri - 1]);

  if (clean) {
    if (L < 5) add(S, L + 1, "harder", "one step harder");
    // Three easy wins at this level: repeating it is no longer on the menu.
    let easy = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const a = history[i];
      if (a.skill !== S || a.level !== L || !a.correct || a.tries > 1) break;
      easy++;
    }
    if (easy < 3) add(S, L, "same", "same again");
  } else if (shaky) {
    add(S, L, "same", "same again");
    if (L > 1) add(S, L - 1, "easier", "one step easier");
  } else {
    if (L > 1) add(S, L - 1, "easier", "one step easier");
    else add(S, 1, "same", "easiest level again");
    const back = PREREQUISITE[S];
    if (back) add(back, 2, "review", "the skill underneath");
  }
  // Coming back from a review skill: the band skill it supports.
  if (!band.includes(S)) {
    const up = band.find((b) => PREREQUISITE[b] === S);
    if (up) add(up, Math.min(saved(up), clean ? L : L - 1), "switch", "back to the main skill");
  }
  // A skill already finished (three first-try answers at level 5) is not
  // offered again until every skill in the band is finished.
  const finished = (sk: SkillId) => isMastered(sk, history);
  const open = band.filter((b) => !finished(b));
  for (const sk of open.length ? open : band) {
    if (sk === S) continue;
    const recent = history.slice(-10).filter((a) => a.skill === sk).length;
    add(sk, saved(sk), "switch", recent ? "a different skill" : "a different skill, not practised lately");
  }
  if (finished(S) && open.length) {
    // Nothing more to do here: only the other skills remain on the menu.
    return opts.filter((o) => o.skill !== S || o.kind === "easier" || o.kind === "review");
  }
  return opts;
}

/** Turn a chosen option into a plan. */
export function planFromOption(o: PlanOption, reason: string, last?: Attempt): Plan {
  const focus =
    o.kind === "harder" ? "a little harder"
    : o.kind === "easier" ? (last && last.mistake !== "none" ? MISTAKE_TEXT[last.mistake] : "an easier step")
    : o.kind === "review" ? "the step underneath"
    : o.kind === "switch" ? "something new"
    : o.kind === "start" ? "warm up"
    : o.kind === "abstract" ? `the same, as ${REP_LABEL[o.rep]}`
    : o.kind === "concrete" ? `back to ${REP_LABEL[o.rep]}`
    : "one more like that";
  return { skill: o.skill, level: o.level, focus, source: "model", reason, rep: o.rep };
}

/** Mastered: three first-try right answers at the top level (5). */
export function isMastered(skill: SkillId, attempts: Attempt[]): boolean {
  return attempts.filter((a) => a.skill === skill && a.level === 5 && a.correct && a.tries === 1).length >= 3;
}
