import type { Difficulty } from "./types";

// ---------- Difficulty ladder ----------
//
// L1  multiples of ten (20, 50)        — tens rod alone, cleanest entry
// L2  teens (13, 17)                   — English says the ones digit first
//                                        ("fourteen"), a known reversal trap
// L3  two digits, distinct (34, 62)    — the core skill
// L4  reversal pairs / repeats (43,44) — forces attention to position
// L5  exchange required                — ten ones become one ten

export const DIFFICULTY_BANDS: Record<Difficulty, (n: number) => boolean> = {
  1: (n) => n % 10 === 0 && n >= 10 && n <= 90,
  2: (n) => n >= 11 && n <= 19,
  3: (n) => n >= 21 && n <= 99 && n % 10 !== 0 && Math.floor(n / 10) !== n % 10,
  4: (n) => n >= 21 && n <= 99 && n % 10 !== 0,
  5: (n) => n >= 10 && n <= 99,
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  1: "Tens only",
  2: "Teen numbers",
  3: "Two digits",
  4: "Digits that look alike",
  5: "Trading ten ones",
};

export const inBand = (d: Difficulty, n: number): boolean => DIFFICULTY_BANDS[d](n);

export const stepUp = (d: Difficulty): Difficulty =>
  (Math.min(5, d + 1) as Difficulty);

export const stepDown = (d: Difficulty): Difficulty =>
  (Math.max(1, d - 1) as Difficulty);
