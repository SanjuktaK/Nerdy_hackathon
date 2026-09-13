// ============================================================
// L4 — skill registry. Adding a band means adding a module here
// and nothing else. No layer above L4 names a skill.
// ============================================================

import type { AnySkillModule } from "./types";
import { placeValue99 } from "./place-value";
import { composeTens } from "./compose-tens";
import { addSubWithin20, countingTo20 } from "./stubs/ten-frame-skills";

export const SKILLS: readonly AnySkillModule[] = [
  countingTo20,
  placeValue99,
  composeTens,
  addSubWithin20,
];

/** The two skills on the ship list (§2). A session draws only from these. */
export const SHIPPING_SKILL_IDS = [placeValue99.id, composeTens.id] as const;

const BY_ID = new Map(SKILLS.map((s) => [s.id, s]));

export function getSkill(id: string): AnySkillModule {
  const s = BY_ID.get(id);
  if (!s) throw new Error(`unknown skill: ${id}`);
  return s;
}

export const hasSkill = (id: string): boolean => BY_ID.has(id);

export const shippingSkills = (): AnySkillModule[] =>
  SKILLS.filter((s) => s.status === "SHIPS");

/** Roadmap rows from §2 that have no module yet. Shown, greyed, in §12. */
export const ROADMAP: readonly { band: string; title: string; manipulative: string }[] = [
  { band: "2", title: "Place value to 999, regrouping", manipulative: "Base-ten blocks" },
  { band: "3", title: "Multiplication as arrays", manipulative: "Array grid" },
  { band: "3", title: "Fractions as numbers", manipulative: "Fraction bars" },
  { band: "4", title: "Multi-digit multiplication", manipulative: "Area model" },
  { band: "5", title: "Fraction and decimal operations", manipulative: "Decimal grid" },
];
