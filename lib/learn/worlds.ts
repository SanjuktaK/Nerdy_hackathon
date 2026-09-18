// ============================================================
// Story worlds.
//
// A world is a skin: the hero, the thing being counted, the jar that fills
// as the session goes, the bead shape and colour. It never changes a
// number, a level or a skill.
//
// Winnie-the-Pooh is the default. The 1926 book character is in the public
// domain, which is why he is drawn here as the book's plain bear with a honey
// pot, not any studio's version. The other worlds are original characters in
// the setting a show lives in, so a child who loves a trains show gets a
// friendly engine rather than a copy of someone's trademark.
// ============================================================

import type { BodyId, IconId, SkillId, WorldId } from "./types";

export type BeadShape = "drop" | "round" | "egg" | "star" | "bubble";

export interface World {
  id: WorldId;
  label: string;
  hero: string;
  /** What the hero is, for the model and for alt text. */
  heroKind: string;
  item: { one: string; many: string };
  treasure: string;
  jar: string;
  /** "eats", "carries", ... — used by the subtraction stories. */
  takeVerb: string;
  bead: BeadShape;
  body: BodyId;
  icon: IconId;
  colours: {
    body: string;
    accent: string;
    bead: string;
    beadEdge: string;
    tens: string;
    tensEdge: string;
    hundreds: string;
    hundredsEdge: string;
    fill: string;
    sky: string;
    ground: string;
  };
}

export type BuiltInWorld = Exclude<WorldId, "custom">;

export const WORLDS: Record<BuiltInWorld, World> = {
  honey: {
    id: "honey",
    label: "Winnie-the-Pooh & honey",
    hero: "Pooh",
    heroKind: "a small, round, kind bear who loves honey",
    item: { one: "honey pot", many: "honey pots" },
    treasure: "honey",
    jar: "honey jar",
    takeVerb: "eats",
    bead: "drop",
    body: "bear",
    icon: "honeypot",
    colours: {
      body: "#d9a441",
      accent: "#c0392b",
      bead: "#f2b63d",
      beadEdge: "#b87d12",
      tens: "#e08a2c",
      tensEdge: "#a35a12",
      hundreds: "#9b6a3c",
      hundredsEdge: "#6b4524",
      fill: "#f4b942",
      sky: "#fdf3dc",
      ground: "#e9dcb8",
    },
  },
  trains: {
    id: "trains",
    label: "Trains",
    hero: "Tilly the engine",
    heroKind: "a cheerful little blue steam engine",
    item: { one: "carriage", many: "carriages" },
    treasure: "coal",
    jar: "coal truck",
    takeVerb: "drops off",
    bead: "round",
    body: "engine",
    icon: "carriage",
    colours: {
      body: "#3f7cc4",
      accent: "#d94f3d",
      bead: "#4f8fd6",
      beadEdge: "#27588f",
      tens: "#2f9e8f",
      tensEdge: "#1c6b60",
      hundreds: "#6a5acd",
      hundredsEdge: "#433894",
      fill: "#4b4f5c",
      sky: "#e6f0fa",
      ground: "#cfd8c4",
    },
  },
  dinos: {
    id: "dinos",
    label: "Dinosaurs",
    hero: "Rexy",
    heroKind: "a gentle little green dinosaur",
    item: { one: "dino egg", many: "dino eggs" },
    treasure: "leaves",
    jar: "nest",
    takeVerb: "hatches",
    bead: "egg",
    body: "dino",
    icon: "egg",
    colours: {
      body: "#5aa05a",
      accent: "#e8a33d",
      bead: "#efe3c2",
      beadEdge: "#a89464",
      tens: "#8fbf6a",
      tensEdge: "#557a3a",
      hundreds: "#c98a4b",
      hundredsEdge: "#86572a",
      fill: "#6fb05f",
      sky: "#eef6e4",
      ground: "#d8cfae",
    },
  },
  space: {
    id: "space",
    label: "Space & rockets",
    hero: "Nova",
    heroKind: "a friendly little astronaut in a round helmet",
    item: { one: "star", many: "stars" },
    treasure: "stardust",
    jar: "star jar",
    takeVerb: "gives away",
    bead: "star",
    body: "astronaut",
    icon: "star",
    colours: {
      body: "#e9ecf5",
      accent: "#7b5cd6",
      bead: "#ffd35c",
      beadEdge: "#c79a14",
      tens: "#8ab4ff",
      tensEdge: "#4a73c4",
      hundreds: "#c49bff",
      hundredsEdge: "#7d52c7",
      fill: "#ffd35c",
      sky: "#e9e8f7",
      ground: "#d5d2ea",
    },
  },
  ocean: {
    id: "ocean",
    label: "Under the sea",
    hero: "Finn",
    heroKind: "a small, curious orange fish",
    item: { one: "shell", many: "shells" },
    treasure: "pearls",
    jar: "treasure chest",
    takeVerb: "gives away",
    bead: "bubble",
    body: "fish",
    icon: "shell",
    colours: {
      body: "#f08a3c",
      accent: "#2f8fb0",
      bead: "#7fd0e8",
      beadEdge: "#2f8fb0",
      tens: "#f6a5b8",
      tensEdge: "#c05a74",
      hundreds: "#8e7cd6",
      hundredsEdge: "#5a4aa0",
      fill: "#bfe9f5",
      sky: "#e3f4f8",
      ground: "#efe3c6",
    },
  },
};

export const WORLD_ORDER: BuiltInWorld[] = ["honey", "trains", "dinos", "space", "ocean"];

/**
 * Map what the caregiver typed to the nearest world. Anything unknown —
 * including an empty answer from a child who likes colours but no show —
 * lands on honey, as asked.
 */
export function worldForShow(show: string): BuiltInWorld {
  const s = show.toLowerCase();
  if (/pooh|winnie|honey|bear|piglet|tigger|eeyore/.test(s)) return "honey";
  if (/train|thomas|engine|chugg|railway|locomotive/.test(s)) return "trains";
  if (/dino|jurassic|rex|land before/.test(s)) return "dinos";
  if (/space|rocket|planet|star|astronaut|moon/.test(s)) return "space";
  if (/ocean|sea|fish|nemo|dory|octonaut|shark|whale|mermaid/.test(s)) return "ocean";
  return "honey";
}

/**
 * Template stories: the fallback whenever the model is slow, missing, or
 * writes something the validator rejects. Placeholders: {hero} {a} {b} {n}
 * {item} {items} {treasure} {jar} {take}.
 */
export const STORY_TEMPLATES: Record<SkillId, string[]> = {
  count: ["{hero} lines up some {items}.", "{hero} finds {items} in a row."],
  recognise: ["{hero} holds up a number card.", "{hero} finds a number card on the floor."],
  compare: ["{hero} has two piles of {items}.", "{hero} sees two groups of {items}."],
  add10: ["{hero} has {a} {items}. {hero} finds {b} more.", "{a} {items}, then {b} more for {hero}."],
  sub10: ["{hero} has {a} {items}. {hero} {take} {b}.", "There are {a} {items}. {hero} {take} {b}."],
  shapes: ["{hero} finds a shape.", "{hero} draws a shape on paper."],
  add20: ["{hero} has {a} {items}. {hero} finds {b} more.", "{a} {items} and {b} more {items}."],
  sub20: ["{hero} has {a} {items}. {hero} {take} {b}.", "{a} {items}. {hero} {take} {b} of them."],
  placeValue100: ["{hero} wants {n} {items}.", "{hero} needs {n} {items} for the {jar}."],
  timeHour: ["{hero} looks at the clock.", "{hero} checks the clock before snack time."],
  add1000: ["{hero} has {a} {items}. {hero} gets {b} more.", "{a} {items} plus {b} more."],
  sub1000: ["{hero} has {a} {items}. {hero} {take} {b}.", "{a} {items}. {hero} {take} {b}."],
  placeValue1000: ["{hero} counts {n} {items}.", "{hero} fills the {jar} with {n} {items}."],
  money: ["{hero} has coins for a treat.", "{hero} counts coins to buy {items}."],
  measure: ["{hero} measures a stick with a ruler.", "{hero} lays a stick next to the ruler."],
};

export function fillTemplate(
  template: string,
  world: World,
  heroName: string,
  nums: { a?: number; b?: number; n?: number }
): string {
  return template
    .replaceAll("{hero}", heroName)
    .replaceAll("{items}", world.item.many)
    .replaceAll("{item}", world.item.one)
    .replaceAll("{treasure}", world.treasure)
    .replaceAll("{jar}", world.jar)
    .replaceAll("{take}", world.takeVerb)
    .replaceAll("{a}", String(nums.a ?? ""))
    .replaceAll("{b}", String(nums.b ?? ""))
    .replaceAll("{n}", String(nums.n ?? ""));
}

/** The world a character lives in: the model-designed one if there is one. */
export function worldOf(c: { world: WorldId; skin?: World }): World {
  return c.skin ?? WORLDS[c.world === "custom" ? "honey" : c.world];
}

/** Darken a #rrggbb colour, for the edges of model-chosen fills. */
export function shade(hex: string, amount = 0.35): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.round(v * (1 - amount)));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export const BODIES: BodyId[] = ["bear", "engine", "dino", "astronaut", "fish", "kid", "puppy", "cat", "bunny", "robot", "pig"];
export const ICONS: IconId[] = ["honeypot", "carriage", "egg", "star", "shell", "cookie", "ball", "apple", "car", "flower", "candy", "block"];
export const BEADS: BeadShape[] = ["drop", "round", "egg", "star", "bubble"];

/** Mix a colour towards white. */
export function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(v + (255 - v) * amount);
  return "#" + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, "0")).join("");
}

export interface Buddy {
  id: BodyId;
  label: string;
  /** Told to the model, which cannot look the show up. */
  kind: string;
  /** Characters with a hand-made world of their own. */
  world?: BuiltInWorld;
  body: string;
  accent: string;
  icon: IconId;
  bead: BeadShape;
}

/** The generic characters a caregiver picks from. Pooh's bear comes first. */
export const BUDDIES: Buddy[] = [
  { id: "bear", label: "Bear", kind: "a small, round, kind bear", world: "honey", body: "#d9a441", accent: "#c0392b", icon: "honeypot", bead: "drop" },
  { id: "engine", label: "Choo-choo train", kind: "a cheerful little steam engine", world: "trains", body: "#3f7cc4", accent: "#d94f3d", icon: "carriage", bead: "round" },
  { id: "dino", label: "Dinosaur", kind: "a gentle little dinosaur", world: "dinos", body: "#5aa05a", accent: "#e8a33d", icon: "egg", bead: "egg" },
  { id: "pig", label: "Piglet", kind: "a small pink piglet", body: "#f2a7b8", accent: "#7fb3e0", icon: "apple", bead: "round" },
  { id: "puppy", label: "Puppy", kind: "a brave little puppy", body: "#c8925a", accent: "#d94f3d", icon: "ball", bead: "round" },
  { id: "cat", label: "Kitty", kind: "a friendly cat", body: "#9a9aa8", accent: "#f2b63d", icon: "cookie", bead: "round" },
  { id: "bunny", label: "Bunny", kind: "a soft little bunny", body: "#e3d5c3", accent: "#e58a9a", icon: "flower", bead: "egg" },
  { id: "robot", label: "Robot", kind: "a friendly robot", body: "#8fb3cf", accent: "#e0a526", icon: "block", bead: "round" },
  { id: "fish", label: "Fish", kind: "a small, curious fish", world: "ocean", body: "#f08a3c", accent: "#2f8fb0", icon: "shell", bead: "bubble" },
  { id: "astronaut", label: "Astronaut", kind: "a friendly little astronaut", world: "space", body: "#e9ecf5", accent: "#7b5cd6", icon: "star", bead: "star" },
  { id: "kid", label: "Kid", kind: "a cheerful young child", body: "#5aa0d8", accent: "#e0a526", icon: "candy", bead: "round" },
];

export const buddyById = (id: BodyId | undefined): Buddy => BUDDIES.find((b) => b.id === id) ?? BUDDIES[0];

/** A starting world for a picked character, before the model dresses it. */
export function buddyWorld(b: Buddy): World {
  if (b.world) return WORLDS[b.world];
  const tens = b.accent;
  const hundreds = shade(b.accent, 0.25);
  return {
    id: "custom",
    label: b.label,
    hero: b.label,
    heroKind: b.kind,
    item: { one: "star", many: "stars" },
    treasure: "stars",
    jar: "jar",
    takeVerb: "gives away",
    bead: b.bead,
    body: b.id,
    icon: b.icon,
    colours: {
      body: b.body,
      accent: b.accent,
      bead: b.body,
      beadEdge: shade(b.body),
      tens,
      tensEdge: shade(tens),
      hundreds,
      hundredsEdge: shade(hundreds),
      fill: b.body,
      sky: tint(b.body, 0.86),
      ground: tint(b.accent, 0.7),
    },
  };
}

/** Colours a caregiver can pick for the character. Soft, and all readable on cream. */
export const BUDDY_COLOURS: { name: string; hex: string }[] = [
  { name: "Blue", hex: "#3f8fd8" },
  { name: "Red", hex: "#e0564a" },
  { name: "Yellow", hex: "#f2c14e" },
  { name: "Green", hex: "#5aa05a" },
  { name: "Pink", hex: "#f2a7b8" },
  { name: "Orange", hex: "#f08a3c" },
  { name: "Purple", hex: "#8e7cd6" },
  { name: "Brown", hex: "#b07a4a" },
  { name: "Grey", hex: "#9a9aa8" },
];

/** The picked character in the picked colour. */
export function paintBuddy(b: Buddy, hex?: string): Buddy {
  return hex && /^#[0-9a-f]{6}$/i.test(hex) ? { ...b, body: hex, world: undefined } : b;
}
