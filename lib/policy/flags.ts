// ============================================================
// §6.4 Attention flags.
//
// Observations for caregiver review. Never a diagnosis. Every string
// here is phrased as something that happened, not something the child is.
// ============================================================

import type { LearnerEvent, Representation } from "../core/types";
import { isCorrect } from "../core/types";
import { BEAD_CODE_LABEL, type BeadCode } from "../skills/bead-common";

export type FlagId =
  | "PERSISTENT_MISCONCEPTION"
  | "LATENCY_RISING"
  | "ABANDONMENT"
  | "REPRESENTATION_GAP";

export interface AttentionFlag {
  id: FlagId;
  /** Observation language. Reads as a sentence about sessions, not a child. */
  text: string;
  /** Raw evidence, so a caregiver can check the claim. */
  evidence: string;
}

/** Sessions are derived from gaps in the log, so imported data still works. */
export const SESSION_GAP_MS = 30 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const ABANDONMENT_THRESHOLD = 0.25;
export const LATENCY_RISE_THRESHOLD = 0.5;
const MIN_EVENTS = 6;

export function splitSessions(events: readonly LearnerEvent[]): LearnerEvent[][] {
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  const out: LearnerEvent[][] = [];
  let current: LearnerEvent[] = [];
  let last = 0;
  for (const ev of sorted) {
    if (current.length && ev.ts - last > SESSION_GAP_MS) {
      out.push(current);
      current = [];
    }
    current.push(ev);
    last = ev.ts;
  }
  if (current.length) out.push(current);
  return out;
}

const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const label = (code: string): string =>
  BEAD_CODE_LABEL[code as BeadCode] ?? code.toLowerCase().replace(/_/g, " ");

export function attentionFlags(events: readonly LearnerEvent[], now = Date.now()): AttentionFlag[] {
  const flags: AttentionFlag[] = [];
  if (events.length < MIN_EVENTS) return flags;

  const sessions = splitSessions(events);

  // 1 — same misconception persisting 3+ sessions after it was first
  //     remediated. "Post-remediation" = the sessions after the first one
  //     it appeared in, since the policy remediates on the next task.
  const codeSessions = new Map<string, number>();
  for (const s of sessions) {
    const codes = new Set(s.filter((e) => !isCorrect(e.result)).map((e) => e.result));
    for (const c of codes) codeSessions.set(c, (codeSessions.get(c) ?? 0) + 1);
  }
  for (const [code, n] of codeSessions) {
    if (code === "UNCLASSIFIED" || n < 3) continue;
    flags.push({
      id: "PERSISTENT_MISCONCEPTION",
      text: `"${label(code)}" has come up in ${n} separate sessions, after the app had already changed the task to work on it.`,
      evidence: `${code} × ${n} sessions`,
    });
  }

  // 2 — median latency rising >50% week over week
  const thisWeek = events.filter((e) => e.ts > now - WEEK_MS);
  const lastWeek = events.filter((e) => e.ts <= now - WEEK_MS && e.ts > now - 2 * WEEK_MS);
  if (thisWeek.length >= MIN_EVENTS && lastWeek.length >= MIN_EVENTS) {
    const a = median(lastWeek.map((e) => e.latencyMs));
    const b = median(thisWeek.map((e) => e.latencyMs));
    if (a > 0 && (b - a) / a > LATENCY_RISE_THRESHOLD) {
      flags.push({
        id: "LATENCY_RISING",
        text: `Tasks are taking longer this week than last week — a typical task went from ${Math.round(a / 1000)}s to ${Math.round(b / 1000)}s.`,
        evidence: `median ${Math.round(a)}ms → ${Math.round(b)}ms`,
      });
    }
  }

  // 3 — abandonment rate above threshold
  const abandoned = events.filter((e) => e.abandoned).length;
  const rate = abandoned / events.length;
  if (rate > ABANDONMENT_THRESHOLD) {
    flags.push({
      id: "ABANDONMENT",
      text: `${Math.round(rate * 100)}% of tasks were left without an answer. A shorter session or a lower rung may fit better.`,
      evidence: `${abandoned}/${events.length} abandoned`,
    });
  }

  // 4 — accuracy collapse at a specific representation level
  const byRep = new Map<Representation, { n: number; ok: number }>();
  for (const e of events) {
    if (e.phase !== "INDEPENDENT") continue;
    const b = byRep.get(e.representation) ?? { n: 0, ok: 0 };
    b.n += 1;
    b.ok += isCorrect(e.result) ? 1 : 0;
    byRep.set(e.representation, b);
  }
  const names: Record<Representation, string> = {
    C: "beads they can touch",
    R: "drawn sticks and dots",
    A: "written numbers",
  };
  const scored = [...byRep.entries()].filter(([, b]) => b.n >= 4);
  if (scored.length >= 2) {
    const best = Math.max(...scored.map(([, b]) => b.ok / b.n));
    for (const [rep, b] of scored) {
      const acc = b.ok / b.n;
      if (best - acc >= 0.4) {
        flags.push({
          id: "REPRESENTATION_GAP",
          text: `The same skill holds up with other materials but drops to ${Math.round(acc * 100)}% with ${names[rep]}.`,
          evidence: `${rep}: ${b.ok}/${b.n}`,
        });
      }
    }
  }

  return flags;
}
