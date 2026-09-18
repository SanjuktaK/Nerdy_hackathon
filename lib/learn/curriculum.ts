// ============================================================
// Grade bands and skills.
//
// K–2 ship in this demo. 3–5 are listed so the caregiver sees where the
// app is going, and are not selectable yet.
// ============================================================

import type { GradeBand, Level, Rep, SkillId } from "./types";

export interface GradeInfo {
  id: GradeBand;
  label: string;
  ages: string;
  topics: string;
  available: boolean;
  skills: SkillId[];
}

export const GRADES: GradeInfo[] = [
  {
    id: "K",
    label: "Kindergarten",
    ages: "5–6",
    topics: "Counting to 100, recognising numbers, more / less, adding and taking away within 10, shapes",
    available: true,
    skills: ["count", "recognise", "compare", "add10", "sub10", "shapes"],
  },
  {
    id: "G1",
    label: "1st grade",
    ages: "6–7",
    topics: "Adding and taking away within 20, tens and ones to 100, time to the hour",
    available: true,
    skills: ["add20", "sub20", "placeValue100", "timeHour"],
  },
  {
    id: "G2",
    label: "2nd grade",
    ages: "7–8",
    topics: "Adding and taking away within 1000 with carrying and borrowing, place value to 1000, money, measuring",
    available: true,
    skills: ["add1000", "sub1000", "placeValue1000", "money", "measure"],
  },
  {
    id: "G3",
    label: "3rd grade",
    ages: "8–9",
    topics: "Times tables to 10×10, simple fractions, area and perimeter",
    available: false,
    skills: [],
  },
  {
    id: "G4",
    label: "4th grade",
    ages: "9–10",
    topics: "Multi-digit multiplication, long division, equivalent fractions, decimals",
    available: false,
    skills: [],
  },
  {
    id: "G5",
    label: "5th grade",
    ages: "10–11",
    topics: "Fraction operations, decimal operations, volume, coordinate plane",
    available: false,
    skills: [],
  },
];

export const gradeInfo = (g: GradeBand): GradeInfo => GRADES.find((x) => x.id === g) ?? GRADES[0];

/** Suggested band for an age. Anything past the demo range is capped at 2nd grade. */
export function gradeForAge(age: number): GradeBand {
  if (age <= 5) return "K";
  if (age === 6) return "G1";
  return "G2";
}

export const SKILL_LABEL: Record<SkillId, string> = {
  count: "Counting",
  recognise: "Recognising numbers",
  compare: "More and less",
  add10: "Adding within 10",
  sub10: "Taking away within 10",
  shapes: "Shapes",
  add20: "Adding within 20",
  sub20: "Taking away within 20",
  placeValue100: "Tens and ones",
  timeHour: "Time to the hour",
  add1000: "Adding within 1000",
  sub1000: "Taking away within 1000",
  placeValue1000: "Hundreds, tens and ones",
  money: "Money",
  measure: "Measuring",
};

/**
 * Where to go when a child is already at level 1 of a skill and still
 * finding it hard: one step back to the skill underneath it.
 */
export const PREREQUISITE: Partial<Record<SkillId, SkillId>> = {
  add10: "count",
  sub10: "count",
  compare: "count",
  recognise: "count",
  add20: "add10",
  sub20: "sub10",
  placeValue100: "count",
  timeHour: "recognise",
  add1000: "add20",
  sub1000: "sub20",
  placeValue1000: "placeValue100",
  money: "add20",
  measure: "count",
};

/** Skills whose picture can become dots and then numbers only. Counting stops at dots. */
export const REP_LADDER: Partial<Record<SkillId, Rep[]>> = {
  count: ["C", "R"],
  compare: ["C", "R", "A"],
  add10: ["C", "R", "A"],
  sub10: ["C", "R", "A"],
  add20: ["C", "R", "A"],
  sub20: ["C", "R", "A"],
};

export const REP_LABEL: Record<Rep, string> = { C: "pictures", R: "dots", A: "numbers only" };

export const ALL_SKILLS = Object.keys(SKILL_LABEL) as SkillId[];

export const isSkill = (s: unknown): s is SkillId =>
  typeof s === "string" && (ALL_SKILLS as string[]).includes(s);

export const clampLevel = (n: number): Level => Math.max(1, Math.min(5, Math.round(n))) as Level;

/** The skills a child in this band may be given, including one step of review. */
export function allowedSkills(grade: GradeBand): SkillId[] {
  const own = gradeInfo(grade).skills;
  const review = own.map((s) => PREREQUISITE[s]).filter((s): s is SkillId => !!s);
  return [...new Set([...own, ...review])];
}
