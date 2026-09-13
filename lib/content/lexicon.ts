// ============================================================
// The seed lexicon. Eight interests, hand-authored, deterministic.
//
// This is the part a catalogue product stops at — and the reason §9.1
// exists. A child interested in washing machines is not in this table
// and never will be. The table covers the common cases at zero cost and
// zero latency; generation covers everyone else.
// ============================================================

import type { SeedInterest } from "../theme";

export interface Lexeme {
  /** Plural noun for the counted objects. */
  plural: string;
  /** A thing that holds or carries them. Distinct from `plural`. */
  container: string;
  /** A place they are found, written with its article. */
  place: string;
}

export const LEXICON: Record<SeedInterest, Lexeme> = {
  trains: { plural: "train cars", container: "engine", place: "the station" },
  dinosaurs: { plural: "dinosaurs", container: "valley", place: "the river" },
  space: { plural: "stars", container: "rocket", place: "the window" },
  cats: { plural: "cats", container: "basket", place: "the step" },
  buses: { plural: "buses", container: "garage", place: "the stop" },
  fish: { plural: "fish", container: "tank", place: "the reef" },
  rocks: { plural: "rocks", container: "bucket", place: "the path" },
  birds: { plural: "birds", container: "cage", place: "the branch" },
};

export interface Frame {
  build: (n: number, lx: Lexeme, addend: number) => string;
  spriteKey: string;
}

/** Sentence case. A frame that opens on a noun would otherwise start lowercase. */
const sentence = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Sentence frames for REPRESENT. Every frame is written to clear
 * validateStem: no negation, no vagueness, no bare pronoun, no exclamation,
 * ≤ 14 words, exactly one numeral, and that numeral is the target.
 */
export const REPRESENT_FRAMES: Frame[] = [
  { spriteKey: "container", build: (n, lx) => `The ${lx.container} holds ${n} ${lx.plural}. Show ${n}.` },
  { spriteKey: "row", build: (n, lx) => `${n} ${lx.plural} sit at ${lx.place}. Build ${n} on the frame.` },
  { spriteKey: "group-a", build: (n, lx) => `Count the ${lx.plural} at ${lx.place}. The total is ${n}.` },
  { spriteKey: "row", build: (n, lx) => `${n} ${lx.plural} line up in one row. Make ${n}.` },
  { spriteKey: "container", build: (n, lx) => `One ${lx.container} carries ${n} ${lx.plural}. Place ${n} on the frame.` },
  { spriteKey: "group-b", build: (n, lx) => sentence(`${lx.plural} fill ${lx.place}. The count is ${n}. Show ${n}.`) },
];

/** Sentence frames for EXCHANGE. Two numerals allowed: the target and the addend. */
export const EXCHANGE_FRAMES: Frame[] = [
  { spriteKey: "container", build: (n, lx, a) => `The ${lx.container} holds ${lx.plural}. ${a} more arrive. The total is ${n}.` },
  { spriteKey: "group-b", build: (n, lx, a) => `${a} more ${lx.plural} join the frame. Make the total ${n}.` },
  { spriteKey: "group-a", build: (n, lx, a) => `Add ${a} ${lx.plural} to the frame. Show the total ${n}.` },
  { spriteKey: "row", build: (n, lx, a) => `${a} ${lx.plural} come to ${lx.place}. The new total is ${n}.` },
  { spriteKey: "group-a", build: (n, lx, a) => `Add ${a} more ${lx.plural}. Trade ten ones. The total is ${n}.` },
];

export const framesFor = (taskType: string): Frame[] =>
  taskType === "EXCHANGE" ? EXCHANGE_FRAMES : REPRESENT_FRAMES;

/**
 * Deterministic, stable hash. Used to pick a frame and to pick the
 * "nearest cached theme" when generation fails — the same novel interest
 * always falls back to the same seed interest, so the app stays predictable.
 */
export function stableHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
