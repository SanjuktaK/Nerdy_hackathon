// ============================================================
// Language rules every model output is checked against before anyone sees it.
//
// Literal language for the child — no negation, vagueness, idioms,
// ambiguous pronouns, stacked questions or exclamations — and observation
// language for the grown-up, with no clinical or diagnostic vocabulary.
// ============================================================

export const BANNED_PATTERNS: Array<[RegExp, string]> = [
  [/\b(not|isn't|aren't|don't|didn't|won't|never)\b/i, "negation"],
  [/\b(might|maybe|probably|about|around|roughly|some)\b/i, "vagueness"],
  [/\?[^?]*\?/, "multiple questions"],
  [/\b(imagine|pretend|suppose|what if)\b/i, "counterfactual framing"],
  [/[!]{1}/, "exclamation (reads as raised volume)"],
  [/\b(it|they|them|this|that)\b/i, "ambiguous pronoun"],
];

/**
 * Words that make a note read like an assessment. This is a learning tool,
 * not a clinical instrument, and a note that sounds like a diagnosis invites
 * a parent to treat it as one.
 */
export const BANNED_CLINICAL = [
  /\b(diagnos\w*|disorder|deficit|impair\w*|delay(ed)?|dyscalculi\w*|pathol\w*)\b/i,
  /\b(symptom|prognos\w*|clinical|therapy|treatment|intervention)\b/i,
  /\b(low functioning|high functioning|severe|mild)\b/i,
  /\b(IQ|percentile|grade level|below average|above average)\b/i,
];

export const countWords = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;
