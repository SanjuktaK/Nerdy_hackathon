// ============================================================
// Bead-frame domain. Shared by every skill whose manipulative is
// the two-rod frame: place-value-99 and compose-tens.
// Scope: numbers 10–99, two rods (tens, ones).
// ============================================================

export const TENS_CAPACITY = 9;
export const ONES_CAPACITY = 20; // >10 on purpose: lets the child fail to exchange

export interface BeadState {
  tens: number; // 0..TENS_CAPACITY
  ones: number; // 0..ONES_CAPACITY
}

export const emptyBeadState = (): BeadState => ({ tens: 0, ones: 0 });

export const beadValue = (s: BeadState): number => s.tens * 10 + s.ones;

export const clampBeadState = (s: BeadState): BeadState => ({
  tens: Math.max(0, Math.min(TENS_CAPACITY, Math.round(s.tens))),
  ones: Math.max(0, Math.min(ONES_CAPACITY, Math.round(s.ones))),
});

export const beadStatesEqual = (a: BeadState, b: BeadState): boolean =>
  a.tens === b.tens && a.ones === b.ones;

/** The canonical representation of n: no rod over-filled. */
export const canonicalState = (n: number): BeadState => ({
  tens: Math.floor(n / 10),
  ones: n % 10,
});

/** Ten ones become one ten. The single move compose-tens is about. */
export const exchange = (s: BeadState): BeadState =>
  s.ones >= 10 && s.tens < TENS_CAPACITY
    ? { tens: s.tens + 1, ones: s.ones - 10 }
    : s;

export const canExchange = (s: BeadState): boolean =>
  s.ones >= 10 && s.tens < TENS_CAPACITY;

/** True when the frame holds the target in non-canonical form (right value, unexchanged). */
export const isNonCanonical = (s: BeadState, target: number): boolean =>
  beadValue(s) === target && s.ones >= 10;
