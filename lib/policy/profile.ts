// ============================================================
// §6.3 Component profile. Five bars, plain language, for the
// caregiver app. Derived entirely from the event log.
//
// The last component — language load tolerance — is what Surface D
// (§9.4) reads to decide how short a correction has to be.
// ============================================================

import { REPRESENTATIONS, type LearnerEvent, type Representation } from "../core/types";
import { isCorrect } from "../core/types";
import { getSkill, hasSkill, shippingSkills } from "../skills/registry";
import type { ComponentId } from "../skills/types";
import { verdict, replayMastery } from "./mastery";

export interface ComponentScore {
  id: ComponentId;
  label: string;
  /** 0..1, or null when there is not enough evidence yet. */
  score: number | null;
  samples: number;
  /** One sentence a parent can read without a glossary. */
  plain: string;
}

const MIN_SAMPLES = 4;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const independent = (events: readonly LearnerEvent[]) =>
  events.filter((e) => e.phase === "INDEPENDENT" && !e.abandoned);

// ---------- code-derived components ----------

function codeComponent(
  id: ComponentId,
  events: readonly LearnerEvent[]
): ComponentScore | null {
  let label = "";
  let relevant = 0;
  let penalised = 0;

  for (const ev of events) {
    if (!hasSkill(ev.skillId)) continue;
    const skill = getSkill(ev.skillId);
    const spec = skill.components.find((c) => c.id === id);
    if (!spec) continue;
    label = label || spec.label;
    relevant += 1;
    if (spec.penalisedBy.includes(ev.result)) penalised += 1;
  }

  if (!label) return null;
  const score = relevant >= MIN_SAMPLES ? clamp01(1 - penalised / relevant) : null;
  return {
    id,
    label,
    score,
    samples: relevant,
    plain: plainFor(id, score, penalised),
  };
}

function plainFor(id: ComponentId, score: number | null, penalised: number): string {
  if (score === null) return "Not enough tasks yet to say.";
  const strong = score >= 0.8;
  const mixed = score >= 0.55;
  switch (id) {
    case "placeValue":
      return strong
        ? "Puts tens and ones on the right rods."
        : mixed
          ? "Usually picks the right rod, sometimes swaps them."
          : `Places digits on the wrong rods often (${penalised} times so far).`;
    case "exchange":
      return strong
        ? "Trades ten ones for one ten without prompting."
        : mixed
          ? "Trades ten ones for one ten with a reminder."
          : "Reaches the right amount but leaves ten ones untraded.";
    case "counting":
      return strong
        ? "Counts beads accurately."
        : mixed
          ? "Counts accurately most of the time."
          : "Lands one bead off fairly often.";
    default:
      return "";
  }
}

// ---------- representation reach ----------

function representationReach(events: readonly LearnerEvent[]): ComponentScore {
  const mastery = replayMastery(events);
  let best = -1;
  let bestRep: Representation | null = null;

  for (const cell of Object.values(mastery)) {
    if (verdict(cell) !== "ADVANCE") continue;
    const i = REPRESENTATIONS.indexOf(cell.representation);
    if (i > best) {
      best = i;
      bestRep = cell.representation;
    }
  }

  const names: Record<Representation, string> = {
    C: "beads they can touch",
    R: "drawn sticks and dots",
    A: "written numbers",
  };

  return {
    id: "representation",
    label: "How far from the beads they can work",
    score: bestRep ? (best + 1) / REPRESENTATIONS.length : null,
    samples: events.length,
    plain: bestRep
      ? `Works reliably with ${names[bestRep]}.`
      : "Still building the first level: beads they can touch.",
  };
}

// ---------- language load tolerance ----------

export interface LanguageLoad {
  tolerance: number | null;
  /** Word ceiling Surface D should write to. */
  maxWords: number;
  shortAccuracy: number | null;
  longAccuracy: number | null;
  shortLatencyMs: number | null;
  longLatencyMs: number | null;
}

export const SHORT_STEM_WORDS = 8;

/**
 * Latency × accuracy against stem word count (§6.3). Split the log at
 * SHORT_STEM_WORDS and compare. A child who slows down and gets less
 * accurate on longer sentences has a low tolerance, and the correction
 * text should shrink to match.
 */
export function languageLoad(
  events: readonly LearnerEvent[],
  stemWords: (ev: LearnerEvent) => number
): LanguageLoad {
  const rows = independent(events).map((ev) => ({
    words: stemWords(ev),
    correct: isCorrect(ev.result),
    latency: ev.latencyMs,
  }));

  const short = rows.filter((r) => r.words <= SHORT_STEM_WORDS);
  const long = rows.filter((r) => r.words > SHORT_STEM_WORDS);

  if (short.length < MIN_SAMPLES || long.length < MIN_SAMPLES) {
    return {
      tolerance: null,
      maxWords: 14,
      shortAccuracy: null,
      longAccuracy: null,
      shortLatencyMs: null,
      longLatencyMs: null,
    };
  }

  const acc = (xs: typeof rows) => xs.filter((r) => r.correct).length / xs.length;
  const shortAcc = acc(short);
  const longAcc = acc(long);
  const shortLat = median(short.map((r) => r.latency));
  const longLat = median(long.map((r) => r.latency));

  const accuracyDrop = Math.max(0, shortAcc - longAcc);
  const latencyRise = shortLat > 0 ? Math.max(0, (longLat - shortLat) / shortLat) : 0;
  const tolerance = clamp01(1 - accuracyDrop - Math.min(0.5, latencyRise) * 0.5);

  return {
    tolerance,
    maxWords: tolerance < 0.5 ? 8 : tolerance < 0.75 ? 11 : 14,
    shortAccuracy: shortAcc,
    longAccuracy: longAcc,
    shortLatencyMs: shortLat,
    longLatencyMs: longLat,
  };
}

// ---------- the five bars ----------

export function componentProfile(
  events: readonly LearnerEvent[],
  stemWords: (ev: LearnerEvent) => number
): ComponentScore[] {
  const ind = independent(events);
  const ids: ComponentId[] = ["placeValue", "exchange", "counting"];
  const derived = ids
    .map((id) => codeComponent(id, ind))
    .filter((c): c is ComponentScore => c !== null);

  const ll = languageLoad(events, stemWords);

  return [
    ...derived,
    representationReach(events),
    {
      id: "languageLoad",
      label: "How much wording they can hold",
      score: ll.tolerance,
      samples: ind.length,
      plain:
        ll.tolerance === null
          ? "Not enough tasks yet to say."
          : ll.tolerance >= 0.75
            ? "Longer sentences do not slow them down."
            : ll.tolerance >= 0.5
              ? "Longer sentences slow them down a little."
              : "Shorter sentences work noticeably better.",
    },
  ];
}

/** Which shipping skills the child has touched. Used for the §12 skill list. */
export const touchedSkills = (events: readonly LearnerEvent[]): string[] =>
  shippingSkills()
    .map((s) => s.id)
    .filter((id) => events.some((e) => e.skillId === id));
