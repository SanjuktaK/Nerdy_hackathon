// ============================================================
// Noticing when things are getting hard — from answers and taps only.
// No camera, no microphone, no guessing at feelings.
//
// When a sign shows up, the child is *offered* a break. They can always say
// "keep going"; nothing is ever forced, and an offer is never repeated
// straight away.
// ============================================================

import type { Attempt } from "./types";

export type OverloadSign = "misses" | "rushing" | "tapping";

export const SIGN_TEXT: Record<OverloadSign, string> = {
  misses: "two tricky puzzles in a row",
  rushing: "very quick answers, like guessing",
  tapping: "lots of fast tapping",
};

/** What the child hears. Calm, literal, and never about doing badly. */
export const OFFER_LINE: Record<OverloadSign, string> = {
  misses: "These are tricky. Would you like a break?",
  rushing: "Let us slow down. Would you like a break?",
  tapping: "Would you like a break?",
};

/** Two puzzles in a row where the answer had to be shown. */
export function missedTwice(attempts: Attempt[]): boolean {
  const last = attempts.slice(-2);
  return last.length === 2 && last.every((a) => !a.correct);
}

/** Many taps close together: 7 within 2.5 seconds. */
export function franticTapping(tapTimes: number[], now: number): boolean {
  return tapTimes.filter((t) => now - t < 2500).length >= 7;
}

/** A wrong answer given within 1.2 s of the puzzle appearing counts as a rushed guess. */
export const RUSHED_MS = 1200;

/** How many questions to wait after an offer before offering again. */
export const OFFER_COOLDOWN = 3;
