// ============================================================
// Shared vocabulary for the adaptive story flow.
//
// The split of responsibilities is the same one the rest of the app makes:
// the model decides *what to practise next* and *how to say it*; the engine
// decides the numbers and checks the answer. A 1.5B model is good at the
// first and unreliable at the second.
// ============================================================

export type WorldId = "honey" | "trains" | "dinos" | "space" | "ocean" | "custom";

/** The character bodies we can draw. The model picks one; it never draws. */
export type BodyId = "bear" | "engine" | "dino" | "astronaut" | "fish" | "kid" | "puppy" | "cat" | "bunny" | "robot" | "pig";

/** The countable things we can draw. */
export type IconId = "honeypot" | "carriage" | "egg" | "star" | "shell" | "cookie" | "ball" | "apple" | "car" | "flower" | "candy" | "block";

/** How much support the caregiver says the child usually needs. */
export type SupportLevel = "light" | "some" | "lots";

export type Communication = "sentences" | "phrases" | "few-words";

/** The four ways a right answer can be marked. */
export type CheerStyle = "woohoo" | "chime" | "smile" | "quiet";

export type ReadAloud = "auto" | "tap" | "off";

/** The living background: moving slowly, frozen, or none at all. */
export type BackgroundMode = "moving" | "still" | "plain";

export type MonoTone = "grey" | "warm" | "blue" | "green" | "lavender";

export type GradeBand = "K" | "G1" | "G2" | "G3" | "G4" | "G5";

/** Everything the caregiver told us on first open. Sent to the model as JSON. */
export interface ChildProfile {
  name: string;
  age: number;
  grade: GradeBand;
  support: SupportLevel;
  communication: Communication;
  /** Bright or shifting colour is upsetting → monochrome UI. */
  colourSensitive: boolean;
  soundSensitive: boolean;
  likesStories: boolean;
  /** Free text, as the caregiver typed it ("Winnie the Pooh"). */
  favouriteShow: string;
  /**
   * The look the caregiver picked from the generic characters. The model
   * runs offline and cannot look a show up, so it is told what to draw
   * rather than asked to guess.
   */
  buddy?: BodyId;
  /** The colour the caregiver picked for it, #rrggbb. Unset: the character's own. */
  buddyColour?: string;
  world: WorldId;
  cheer: CheerStyle;
  /** Read stories and prompts aloud: automatically, only when the speaker is tapped, or never. */
  readAloud?: ReadAloud;
  /** With colourSensitive: the one calm tone the whole app is shown in. */
  monoTone?: MonoTone;
  /** Switch off every animation, whatever the OS says. */
  reduceMotion?: boolean;
  background?: BackgroundMode;
  /** Puzzles before the break: 3, 5 or 8. */
  sessionLength?: number;
  /** Who the friend sounds like. Unset: from its look (animals sound like a bear, others like a child). */
  voiceStyle?: "child" | "bear" | "cartoon" | "grownup";
  /** Master volume, 0–1. */
  volume?: number;
  /** Bead clicks, coin clinks, counting pops. Default on. */
  soundEffects?: boolean;
  /** Offer a break when answers suggest things are getting hard. Off unless a grown-up turns it on: a popup mid-puzzle can itself distract. */
  overloadCheck?: boolean;
  /** Reading comfort: text size, extra spacing, an easy-to-read font. */
  textSize?: "normal" | "large" | "xlarge";
  wideSpacing?: boolean;
  readableFont?: boolean;
  /** skill → the IEP / therapy goal the grown-up is working towards. For the report. */
  goals?: Partial<Record<SkillId, string>>;
  /** Show a "watch first" demo the first time a skill comes up. Default on. */
  showDemos?: boolean;
  /** Consent to let the app change difficulty and update the learner model. */
  adaptConsent: boolean;
  createdAt: number;
}

/**
 * The companion, generated once at the end of onboarding and kept.
 * Rendered from these fields as SVG — nothing here is an image path.
 */
export interface Character {
  name: string;
  world: WorldId;
  /** Hex colours, validated. */
  body: string;
  accent: string;
  accessory: "none" | "scarf" | "hat" | "bow" | "cap";
  catchphrase: string;
  /** What the character collects; drives the progress jar. */
  treasure: string;
  source: "model" | "fallback";
  /**
   * The story world, designed once by the model from the caregiver's
   * favourite-show answer. Absent on characters saved before this existed,
   * in which case the built-in world for `world` is used.
   */
  skin?: import("./worlds").World;
}

export type SkillId =
  | "count"
  | "recognise"
  | "compare"
  | "add10"
  | "sub10"
  | "shapes"
  | "add20"
  | "sub20"
  | "placeValue100"
  | "timeHour"
  | "add1000"
  | "sub1000"
  | "placeValue1000"
  | "money"
  | "measure";

export type Level = 1 | 2 | 3 | 4 | 5;

/**
 * Concrete → representational → abstract. The same question as pictures of
 * things, as simple dots, or as numbers only.
 */
export type Rep = "C" | "R" | "A";

export type AnswerMode = "choices" | "abacus";

/** What the picture above the question shows. All of it is engine-generated. */
export type Visual =
  | { kind: "items"; groups: number[]; op?: "+" | "-"; rep?: Rep }
  | { kind: "compare"; left: number; right: number; rep?: Rep }
  | { kind: "numeral"; value: number }
  | { kind: "shape"; shape: ShapeId }
  | { kind: "clock"; hour: number }
  | { kind: "coins"; coins: number[] }
  | { kind: "ruler"; length: number }
  | { kind: "sum"; a: number; b: number; op: "+" | "-" }
  | { kind: "build"; value: number };

export type ShapeId = "circle" | "square" | "triangle" | "rectangle" | "star" | "hexagon";

export interface Choice {
  id: string;
  label: string;
  /** Optional picture for the choice, e.g. a group of items to compare. */
  visual?: Visual;
}

export interface Question {
  id: string;
  skill: SkillId;
  level: Level;
  /** Short story line, already filled with the numbers. */
  story: string;
  /** The literal ask, always shown under the story. */
  ask: string;
  visual: Visual;
  mode: AnswerMode;
  choices: Choice[];
  /** Choice id for "choices", the numeric value for "abacus". */
  answer: string;
  /** Which abacus columns to show, when mode is "abacus". */
  columns?: ("hundreds" | "tens" | "ones")[];
  storySource: "model" | "template";
  rep: Rep;
}

/** Named, deterministic reasons an answer can be wrong. */
export type Mistake =
  | "none"
  | "off-by-one"
  | "wrong-operation"
  | "digits-swapped"
  | "regrouping"
  | "chose-opposite"
  | "place-value"
  | "guess";

export interface Attempt {
  questionId: string;
  skill: SkillId;
  level: Level;
  correct: boolean;
  given: string;
  expected: string;
  mistake: Mistake;
  /** Tries on this question before it was solved or moved past. */
  tries: number;
  rep?: Rep;
  /** For an answer the rules could not explain: the model's guess, for the grown-up only. */
  hypothesis?: string;
  ms: number;
  at: number;
}

/** What the planner (model or rules) says to do next. */
export interface Plan {
  skill: SkillId;
  level: Level;
  /** One short phrase about what this question is working on. */
  focus: string;
  source: "model" | "rules";
  reason: string;
  rep?: Rep;
}

/** Built up after each session. The model rewrites it when consent is given. */
export interface LearnerModel {
  /** skill → the level the child is comfortable at. */
  levels: Partial<Record<SkillId, Level>>;
  /** skill → the most abstract way the child is solid with. */
  reps?: Partial<Record<SkillId, Rep>>;
  strengths: SkillId[];
  workingOn: SkillId[];
  /** One or two sentences for the caregiver. */
  note: string;
  sessions: number;
  updatedAt: number;
  source: "model" | "rules" | "initial";
}

export interface SessionRecord {
  id: string;
  startedAt: number;
  endedAt: number;
  attempts: Attempt[];
  plans: Plan[];
  /** Breaks the app offered because things looked hard, and whether the child took them. */
  offers?: { sign: "misses" | "rushing" | "tapping"; accepted: boolean; at: number }[];
}
