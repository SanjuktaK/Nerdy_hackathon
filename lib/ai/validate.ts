// ============================================================
// Every model output passes through here before a child sees it.
// Rejections trigger one retry, then the nearest cached theme (§7).
//
// The banned-pattern list is the autism-specific piece: literal
// language, no idioms, no negation, no ambiguous referents, one
// question at a time. A generic math app has no such filter, and a
// naive prompt violates it constantly — which is what §10 measures.
// ============================================================

import type { Difficulty } from "../core/types";
import { getSkill, hasSkill } from "../skills/registry";

export interface GenerationRequest {
  skillId: string;
  /** Skill-local task type, e.g. "REPRESENT" | "EXCHANGE". */
  taskType: string;
  targetNumber: number; // chosen by us
  addend?: number; // chosen by us
  difficulty: Difficulty; // chosen by us
  interest: string; // "trains" | "washing machines" | ...
  allowedSpriteKeys: readonly string[];
}

export interface GeneratedStem {
  stem: string;
  spriteKey: string;
}

export const GENERATED_STEM_SCHEMA = {
  type: "object",
  required: ["stem", "spriteKey"],
  additionalProperties: false,
  properties: {
    stem: { type: "string", maxLength: 120 },
    spriteKey: { type: "string" },
  },
} as const;

/** Ollama's `format` option takes a JSON schema. This is the batch shape. */
export const STEM_BATCH_SCHEMA = {
  type: "object",
  required: ["stems"],
  additionalProperties: false,
  properties: {
    stems: { type: "array", items: GENERATED_STEM_SCHEMA },
  },
} as const;

export const MAX_STEM_WORDS = 14;

export const BANNED_PATTERNS: Array<[RegExp, string]> = [
  [/\b(not|isn't|aren't|don't|didn't|won't|never)\b/i, "negation"],
  [/\b(might|maybe|probably|about|around|roughly|some)\b/i, "vagueness"],
  [/\?[^?]*\?/, "multiple questions"],
  [/\b(imagine|pretend|suppose|what if)\b/i, "counterfactual framing"],
  [/[!]{1}/, "exclamation (reads as raised volume)"],
  [/\b(it|they|them|this|that)\b/i, "ambiguous pronoun"],
];

/** Idioms and figurative language, the other half of the literal-language rule. */
export const BANNED_IDIOMS: Array<[RegExp, string]> = [
  [/\b(piece of cake|hang on|hold on|a ton of|tons of|a bunch of|loads of)\b/i, "idiom"],
  [/\b(let's|lets)\b/i, "first-person plural framing"],
  [/\b(you'll|you're|we'll|we're)\b/i, "contraction of a future claim"],
];

export interface ValidationResult {
  ok: boolean;
  failures: string[];
}

export function validateStem(
  g: GeneratedStem,
  req: GenerationRequest
): ValidationResult {
  const failures: string[] = [];

  if (typeof g?.stem !== "string" || typeof g?.spriteKey !== "string") {
    return { ok: false, failures: ["schema: missing stem or spriteKey"] };
  }

  const stem = g.stem.trim();
  if (stem.length === 0) failures.push("empty stem");
  const words = stem.split(/\s+/).filter(Boolean);

  if (words.length > MAX_STEM_WORDS) failures.push("too long");

  const numeral = String(req.targetNumber);
  if (!stem.includes(numeral)) failures.push("target numeral absent");

  // Structure preservation: the only numbers allowed in the sentence are the
  // ones the policy chose. A model that quietly invents "12 more" has changed
  // the task, not the language.
  const allowed = new Set([String(req.targetNumber)]);
  if (req.addend !== undefined) allowed.add(String(req.addend));
  for (const found of stem.match(/\d+/g) ?? []) {
    if (!allowed.has(found)) failures.push(`stray numeral: ${found}`);
  }

  if (hasSkill(req.skillId)) {
    const skill = getSkill(req.skillId);
    if (!skill.inBand(req.difficulty, req.targetNumber)) {
      failures.push("target outside difficulty band");
    }
  } else {
    failures.push(`unknown skill: ${req.skillId}`);
  }

  if (req.taskType === "EXCHANGE") {
    const startOnes = req.targetNumber % 10;
    if (req.addend === undefined || startOnes + req.addend < 10) {
      failures.push("exchange task does not force a carry");
    }
  }

  if (!req.allowedSpriteKeys.includes(g.spriteKey)) failures.push("unknown sprite");

  // A sprite key is metadata the model is asked to choose, not a word. Small
  // models routinely write the key into the sentence ("the washing machines
  // in group-a"), which is meaningless to a child and reads as a glitch.
  //
  // Only identifier-shaped keys are checked. "row" and "container" are
  // ordinary English and appear in perfectly good sentences; "group-a" is
  // never anything but a leak.
  for (const key of req.allowedSpriteKeys) {
    if (!/[-_\d]/.test(key)) continue;
    const loose = key.replace(/[-_]/g, "[-_ ]?");
    if (new RegExp(`\\b${loose}\\b`, "i").test(stem)) {
      failures.push(`sprite key leaked into the sentence: ${key}`);
    }
  }

  for (const [re, label] of [...BANNED_PATTERNS, ...BANNED_IDIOMS]) {
    if (re.test(stem)) failures.push(`banned: ${label}`);
  }

  return { ok: failures.length === 0, failures };
}

// ---------- narrative validator (Surface B, §9.2) ----------
//
// Constrained to observation language. No diagnostic vocabulary, because
// this is a learning tool and not a clinical instrument, and a paragraph
// that reads like an assessment invites a parent to treat it as one.

export const BANNED_CLINICAL = [
  /\b(diagnos\w*|disorder|deficit|impair\w*|delay(ed)?|dyscalculi\w*|pathol\w*)\b/i,
  /\b(symptom|prognos\w*|clinical|therapy|treatment|intervention)\b/i,
  /\b(low functioning|high functioning|severe|mild)\b/i,
  /\b(IQ|percentile|grade level|below average|above average)\b/i,
];

export interface NarrativeCheck {
  ok: boolean;
  failures: string[];
}

export function validateNarrative(text: string, maxWords = 120): NarrativeCheck {
  const failures: string[] = [];
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) failures.push("empty");
  if (words.length > maxWords) failures.push("too long");
  for (const re of BANNED_CLINICAL) {
    const m = text.match(re);
    if (m) failures.push(`clinical vocabulary: ${m[0]}`);
  }
  if (/[!]/.test(text)) failures.push("exclamation");
  // An internal representation code reaching a parent reads as a bug.
  if (/\b(?:the\s+)?[CRA]\s+(?:beads|sticks|dots|numbers|level|tasks)\b/.test(text)) {
    failures.push("internal code leaked into the paragraph");
  }
  return { ok: failures.length === 0, failures };
}

/** Surface D output: the same rules as a stem, minus the numeral requirement. */
export function validateCorrection(text: string, maxWords: number): ValidationResult {
  const failures: string[] = [];
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) failures.push("empty");
  if (words.length > maxWords) failures.push("too long");
  for (const [re, label] of [...BANNED_PATTERNS, ...BANNED_IDIOMS]) {
    if (re.test(text)) failures.push(`banned: ${label}`);
  }
  return { ok: failures.length === 0, failures };
}

export const countWords = (s: string): number =>
  s.trim().split(/\s+/).filter(Boolean).length;
