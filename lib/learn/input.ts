// ============================================================
// The browser posts the profile it holds. The server re-checks every
// field before any of it reaches a prompt.
// ============================================================

import { GRADES, clampLevel, isSkill } from "./curriculum";
import type { Attempt, ChildProfile, LearnerModel, Mistake } from "./types";
import { BEADS, BODIES, ICONS, WORLDS, WORLD_ORDER, type World } from "./worlds";

const oneOf = <T extends string>(v: unknown, xs: readonly T[], d: T): T =>
  xs.includes(v as T) ? (v as T) : d;

export function sanitiseProfile(x: unknown): ChildProfile | null {
  if (!x || typeof x !== "object") return null;
  const p = x as Record<string, unknown>;
  const grade = oneOf(p.grade, GRADES.filter((g) => g.available).map((g) => g.id), "K");
  return {
    name: String(p.name ?? "").replace(/[^\p{L} '-]/gu, "").slice(0, 30),
    age: Math.max(4, Math.min(12, Math.round(Number(p.age) || 5))),
    grade,
    support: oneOf(p.support, ["light", "some", "lots"] as const, "some"),
    communication: oneOf(p.communication, ["sentences", "phrases", "few-words"] as const, "phrases"),
    colourSensitive: p.colourSensitive === true,
    soundSensitive: p.soundSensitive === true,
    likesStories: p.likesStories === true,
    favouriteShow: String(p.favouriteShow ?? "").replace(/[^\p{L}\p{N} '&-]/gu, "").slice(0, 40),
    buddy: BODIES.includes(p.buddy as never) ? (p.buddy as ChildProfile["buddy"]) : undefined,
    buddyColour: typeof p.buddyColour === "string" && /^#[0-9a-f]{6}$/i.test(p.buddyColour) ? p.buddyColour : undefined,
    world: oneOf(p.world, [...WORLD_ORDER, "custom"] as const, "honey"),
    cheer: oneOf(p.cheer, ["woohoo", "chime", "smile", "quiet"] as const, "smile"),
    adaptConsent: p.adaptConsent === true,
    readAloud: p.readAloud === undefined ? undefined : oneOf(p.readAloud, ["auto", "tap", "off"] as const, "tap"),
    monoTone: p.monoTone === undefined ? undefined : oneOf(p.monoTone, ["grey", "warm", "blue", "green", "lavender"] as const, "grey"),
    reduceMotion: p.reduceMotion === true,
    volume: p.volume === undefined ? undefined : Math.max(0, Math.min(1, Number(p.volume) || 0)),
    soundEffects: p.soundEffects !== false,
    overloadCheck: p.overloadCheck === true,
    textSize: p.textSize === undefined ? undefined : oneOf(p.textSize, ["normal", "large", "xlarge"] as const, "normal"),
    wideSpacing: p.wideSpacing === true,
    readableFont: p.readableFont === true,
    voiceStyle: p.voiceStyle === undefined ? undefined : oneOf(p.voiceStyle, ["child", "bear", "cartoon", "grownup"] as const, "child"),
    sessionLength: [3, 5, 8].includes(Number(p.sessionLength)) ? Number(p.sessionLength) : undefined,
    background: p.background === undefined ? undefined : oneOf(p.background, ["moving", "still", "plain"] as const, "moving"),
    showDemos: p.showDemos !== false,
    createdAt: Number(p.createdAt) || Date.now(),
  };
}

const MISTAKES: Mistake[] = ["none", "off-by-one", "wrong-operation", "digits-swapped", "regrouping", "chose-opposite", "place-value", "guess"];

export function sanitiseAttempts(x: unknown): Attempt[] {
  if (!Array.isArray(x)) return [];
  return x.slice(-60).flatMap((a): Attempt[] => {
    if (!a || typeof a !== "object" || !isSkill(a.skill)) return [];
    return [{
      questionId: String(a.questionId ?? ""),
      skill: a.skill,
      level: clampLevel(Number(a.level) || 1),
      correct: a.correct === true,
      given: String(a.given ?? "").slice(0, 12),
      expected: String(a.expected ?? "").slice(0, 12),
      mistake: MISTAKES.includes(a.mistake) ? a.mistake : "guess",
      tries: Math.max(1, Math.min(9, Number(a.tries) || 1)),
      rep: a.rep === "R" || a.rep === "A" ? a.rep : "C",
      ms: Math.max(0, Math.min(3_600_000, Number(a.ms) || 0)),
      at: Number(a.at) || Date.now(),
    }];
  });
}

export function sanitiseModel(x: unknown): LearnerModel | null {
  if (!x || typeof x !== "object") return null;
  const m = x as Record<string, unknown>;
  const levels: LearnerModel["levels"] = {};
  if (m.levels && typeof m.levels === "object") {
    for (const [k, v] of Object.entries(m.levels)) if (isSkill(k)) levels[k] = clampLevel(Number(v) || 1);
  }
  const skills = (v: unknown) => (Array.isArray(v) ? v.filter(isSkill) : []);
  const reps: LearnerModel["reps"] = {};
  if (m.reps && typeof m.reps === "object") {
    for (const [k, v] of Object.entries(m.reps)) if (isSkill(k) && (v === "C" || v === "R" || v === "A")) reps[k] = v;
  }
  return {
    reps,
    levels,
    strengths: skills(m.strengths),
    workingOn: skills(m.workingOn),
    note: String(m.note ?? "").slice(0, 400),
    sessions: Math.max(0, Number(m.sessions) || 0),
    updatedAt: Number(m.updatedAt) || Date.now(),
    source: oneOf(m.source, ["model", "rules", "initial"] as const, "initial"),
  };
}

const HEX = /^#[0-9a-f]{6}$/i;
const word = (v: unknown, d: string, max = 40) => {
  const t = String(v ?? "").replace(/[^\p{L}\p{N} '&-]/gu, "").trim().slice(0, max);
  return t || d;
};

/** A model-designed world, as the browser stored it. Every field re-checked. */
export function sanitiseWorld(x: unknown): World {
  const base = WORLDS.honey;
  if (!x || typeof x !== "object") return base;
  const w = x as Record<string, unknown>;
  const builtIn = WORLD_ORDER.find((id) => id === w.id);
  if (builtIn) return WORLDS[builtIn];
  const item = (w.item ?? {}) as Record<string, unknown>;
  const c = (w.colours ?? {}) as Record<string, unknown>;
  const col = (k: keyof World["colours"]) => (typeof c[k] === "string" && HEX.test(c[k] as string) ? (c[k] as string) : base.colours[k]);
  return {
    id: "custom",
    label: word(w.label, "Story"),
    hero: word(w.hero, base.hero, 30),
    heroKind: word(w.heroKind, "a friendly character", 60),
    item: { one: word(item.one, base.item.one, 24), many: word(item.many, base.item.many, 24) },
    treasure: word(w.treasure, base.treasure, 24),
    jar: word(w.jar, "jar", 24),
    takeVerb: word(w.takeVerb, "gives away", 16),
    bead: oneOf(w.bead, BEADS, base.bead),
    body: oneOf(w.body, BODIES, base.body),
    icon: oneOf(w.icon, ICONS, base.icon),
    colours: {
      body: col("body"), accent: col("accent"), bead: col("bead"), beadEdge: col("beadEdge"),
      tens: col("tens"), tensEdge: col("tensEdge"), hundreds: col("hundreds"), hundredsEdge: col("hundredsEdge"),
      fill: col("fill"), sky: col("sky"), ground: col("ground"),
    },
  };
}
