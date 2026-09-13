// ============================================================
// The structured session summary. Two jobs:
//   1. it is the input to Surface B (§9.2), so the model synthesises
//      from counted facts rather than from a raw event dump;
//   2. it is Surface B's deterministic fallback, so the caregiver app
//      says something useful with no model at all.
// ============================================================

import type { LearnerEvent, Representation } from "../core/types";
import { isCorrect } from "../core/types";
import { getSkill, hasSkill } from "../skills/registry";
import { BEAD_CODE_LABEL, type BeadCode } from "../skills/bead-common";
import { splitSessions } from "./flags";

export interface SessionSummary {
  taskCount: number;
  correctCount: number;
  abandonedCount: number;
  promptedCount: number;
  medianLatencyMs: number;
  interests: string[];
  skills: { id: string; title: string; tasks: number; correct: number }[];
  representations: { rep: Representation; tasks: number; correct: number }[];
  topCodes: { code: string; label: string; count: number }[];
  startedAt: number | null;
  endedAt: number | null;
}

const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const codeLabel = (skillId: string, code: string): string => {
  if (hasSkill(skillId)) {
    const lbl = BEAD_CODE_LABEL[code as BeadCode];
    if (lbl) return lbl;
  }
  return code.toLowerCase().replace(/_/g, " ");
};

/** The most recent session in the log, by the gap rule in flags.ts. */
export function latestSession(events: readonly LearnerEvent[]): LearnerEvent[] {
  const sessions = splitSessions(events);
  return sessions.length ? sessions[sessions.length - 1] : [];
}

export function summarise(events: readonly LearnerEvent[]): SessionSummary {
  const scored = events.filter((e) => e.phase === "INDEPENDENT");

  const bySkill = new Map<string, { tasks: number; correct: number }>();
  const byRep = new Map<Representation, { tasks: number; correct: number }>();
  const byCode = new Map<string, { skillId: string; count: number }>();

  for (const ev of scored) {
    const s = bySkill.get(ev.skillId) ?? { tasks: 0, correct: 0 };
    s.tasks += 1;
    s.correct += isCorrect(ev.result) ? 1 : 0;
    bySkill.set(ev.skillId, s);

    const r = byRep.get(ev.representation) ?? { tasks: 0, correct: 0 };
    r.tasks += 1;
    r.correct += isCorrect(ev.result) ? 1 : 0;
    byRep.set(ev.representation, r);

    if (!isCorrect(ev.result)) {
      const c = byCode.get(ev.result) ?? { skillId: ev.skillId, count: 0 };
      c.count += 1;
      byCode.set(ev.result, c);
    }
  }

  return {
    taskCount: scored.length,
    correctCount: scored.filter((e) => isCorrect(e.result)).length,
    abandonedCount: events.filter((e) => e.abandoned).length,
    promptedCount: events.filter((e) => e.promptUsed).length,
    medianLatencyMs: median(scored.map((e) => e.latencyMs)),
    interests: [...new Set(events.map((e) => e.interest))].filter(Boolean),
    skills: [...bySkill.entries()].map(([id, v]) => ({
      id,
      title: hasSkill(id) ? getSkill(id).title : id,
      ...v,
    })),
    representations: [...byRep.entries()].map(([rep, v]) => ({ rep, ...v })),
    topCodes: [...byCode.entries()]
      .map(([code, v]) => ({ code, label: codeLabel(v.skillId, code), count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3),
    startedAt: events.length ? Math.min(...events.map((e) => e.ts)) : null,
    endedAt: events.length ? Math.max(...events.map((e) => e.ts)) : null,
  };
}

const REP_NAME: Record<Representation, string> = {
  C: "beads they could touch",
  R: "drawn sticks and dots",
  A: "written numbers",
};

/**
 * Deterministic narrative. Reads as observation, uses no clinical word,
 * and is what a caregiver sees when no provider is available.
 */
export function templateNarrative(s: SessionSummary): string {
  if (s.taskCount === 0) return "No tasks were finished in this session yet.";

  const parts: string[] = [];
  parts.push(
    `${s.correctCount} of ${s.taskCount} tasks were built correctly on the first independent try.`
  );

  const reps = s.representations.filter((r) => r.tasks > 0);
  if (reps.length) {
    parts.push(
      "Work happened with " +
        reps.map((r) => `${REP_NAME[r.rep]} (${r.correct}/${r.tasks})`).join(" and ") +
        "."
    );
  }

  if (s.topCodes.length) {
    const top = s.topCodes[0];
    parts.push(
      `The pattern that came up most was: ${top.label.toLowerCase()} (${top.count} ${top.count === 1 ? "time" : "times"}).`
    );
  }

  if (s.promptedCount > 0) {
    parts.push(`A prompt was opened on ${s.promptedCount} of them.`);
  }
  if (s.abandonedCount > 0) {
    parts.push(`${s.abandonedCount} tasks were left without an answer.`);
  }
  if (s.medianLatencyMs > 0) {
    parts.push(`A typical task took ${Math.round(s.medianLatencyMs / 1000)} seconds.`);
  }

  const next = s.topCodes.length
    ? `Next time, sitting alongside for the first task of the kind described above would give you a close look at it.`
    : `Next time, letting the same rung repeat once more would confirm the pattern holds.`;
  parts.push(next);

  return parts.join(" ");
}
