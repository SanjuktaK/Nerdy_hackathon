// ============================================================
// Why was an answer wrong? Deterministic, named, and passed to the planner
// so it can aim the next question at the specific slip rather than at
// "wrong" in general.
// ============================================================

import { addNoCarry, subNoBorrow } from "./generate";
import type { Mistake, Question } from "./types";

const reverse = (n: number) => Number(String(n).split("").reverse().join(""));

export function diagnose(q: Question, given: string): Mistake {
  if (given === q.answer) return "none";

  if (q.visual.kind === "compare") return "chose-opposite";

  const g = Number(given);
  const e = Number(q.answer);
  if (!Number.isFinite(g) || !Number.isFinite(e)) return "guess";

  const ab =
    q.visual.kind === "sum" || (q.visual.kind === "items" && q.visual.op)
      ? q.visual.kind === "sum"
        ? { a: q.visual.a, b: q.visual.b, op: q.visual.op }
        : { a: q.visual.groups[0], b: q.visual.groups[1], op: q.visual.op! }
      : null;

  if (ab) {
    if (ab.op === "+" && g === ab.a - ab.b) return "wrong-operation";
    if (ab.op === "-" && g === ab.a + ab.b) return "wrong-operation";
    if (ab.op === "+" && e >= 10 && g === addNoCarry(ab.a, ab.b)) return "regrouping";
    if (ab.op === "-" && ab.a >= 10 && g === subNoBorrow(ab.a, ab.b)) return "regrouping";
  }

  if (e >= 10 && g === reverse(e)) return "digits-swapped";
  if (Math.abs(g - e) === 1) return "off-by-one";

  if (q.mode === "abacus" && e >= 10) {
    // Right digits, wrong columns: a ten counted as a one or similar.
    const gd = String(g).split("").sort().join("");
    const ed = String(e).split("").sort().join("");
    if (gd === ed || Math.abs(g - e) % 9 === 0) return "place-value";
  }
  return "guess";
}

export const MISTAKE_TEXT: Record<Mistake, string> = {
  none: "solved it",
  "off-by-one": "counted one too many or one too few",
  "wrong-operation": "added when it should take away, or the other way",
  "digits-swapped": "swapped the tens and ones digits",
  regrouping: "forgot to carry or borrow a ten",
  "chose-opposite": "picked fewer instead of more (or the other way)",
  "place-value": "put beads in the wrong column",
  guess: "an answer we could not explain",
};
