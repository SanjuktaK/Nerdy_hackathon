// ============================================================
// The three model calls in the story flow. Server-only.
//
//   designCharacter — once, at the end of onboarding
//   planNext        — before every question: skill, level, focus, story
//   reviewSession   — after every session: rewrite the learner model
//
// Each sends the caregiver's answers as JSON, parses JSON back, validates
// every field, and falls back to the rules on any failure or timeout. The
// child never waits more than PLAN_BUDGET_MS for a question.
// ============================================================

import { resolveProvider } from "../ai/provider";
import { BANNED_CLINICAL, BANNED_PATTERNS, countWords } from "../ai/validate";
import { ALL_SKILLS, REP_LABEL, REP_LADDER, SKILL_LABEL, gradeInfo } from "./curriculum";
import { storyWordsFor } from "./sensory";

const gradeSkills = (p: ChildProfile) => gradeInfo(p.grade).skills;
import { MISTAKE_TEXT } from "./diagnose";
import { generateQuestion, hashSeed, rng } from "./generate";
import { planFromOption, planOptions, rulePlan, ruleReview, skillStats } from "./policy";
import type { Attempt, Character, ChildProfile, LearnerModel, Plan, Question, SkillId } from "./types";
import { BEADS, ICONS, WORLDS, buddyById, buddyWorld, paintBuddy, shade, tint, worldForShow, type World } from "./worlds";

const PLAN_BUDGET_MS = Number(process.env.LEARN_PLAN_BUDGET_MS ?? 9000);
const STORY_BUDGET_MS = 6000;
const CHARACTER_BUDGET_MS = 15000;
const REVIEW_BUDGET_MS = 20000;

// ---------- plumbing ----------

async function withBudget<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((res) => {
    t = setTimeout(() => res(null), ms);
  });
  try {
    return await Promise.race([p.catch(() => null), timeout]);
  } finally {
    clearTimeout(t);
  }
}

/** Never trust the shape. Tolerates fences and chatter around the object. */
export function parseObject(raw: string): Record<string, unknown> | null {
  const text = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const tryParse = (s: string) => {
    try {
      const v = JSON.parse(s);
      return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  return tryParse(text) ?? (text.match(/\{[\s\S]*\}/) ? tryParse(text.match(/\{[\s\S]*\}/)![0]) : null);
}

async function askJson(system: string, user: string, budget: number, maxTokens = 220) {
  const provider = await resolveProvider();
  if (provider.id === "none") return { obj: null, provider: provider.id };
  const raw = await withBudget(
    provider.complete({ system, user, maxTokens, temperature: 0.6, format: { type: "object" } }),
    budget
  );
  return { obj: raw ? parseObject(raw) : null, provider: provider.id, raw };
}

// ---------- 1. the character, once ----------

const HEX = /^#[0-9a-f]{6}$/i;
const ACCESSORIES = ["none", "scarf", "hat", "bow", "cap"] as const;

const CHARACTER_SYSTEM = `You design the story world for a young child's maths app, from the child's favourite show and the character the parent picked.
Reply with one JSON object and nothing else, with exactly these keys:
{"hero_name": string, "item": string, "items": string, "item_icon": string, "jar": string, "take_verb": string, "accent_colour": "#rrggbb", "bead": string, "accessory": string, "catchphrase": string}
Rules:
- the_character_is tells you what the character looks like. Build everything around that.
- hero_name: the favourite show's main character, one or two words. If there is no show, a friendly name that suits the_character_is.
- item / items: one thing from the show the child can count, singular and plural, one or two words each.
- item_icon: the closest picture of: ${ICONS.join(", ")}.
- jar: where the hero keeps them, one or two words.
- take_verb: one of: eats, gives away, shares, drops off, uses.
- accent_colour: a soft colour for the character's scarf or hat, as #rrggbb.
- bead: the closest of: ${BEADS.join(", ")}.
- accessory: one of: none, scarf, hat, bow, cap.
- catchphrase: at most 8 calm, literal words. No exclamation marks, no questions.`;

const VERBS = ["eats", "gives away", "shares", "drops off", "uses"];
const noun = (x: unknown, max = 3) => {
  if (typeof x !== "string") return "";
  const t = x.trim().toLowerCase().replace(/^(a|an|the|some)\s+/, "").replace(/[.]+$/, "");
  return /^[\p{L} '-]+$/u.test(t) && countWords(t) <= max ? t : "";
};

/** "cookie" → "cookies", "berry" → "berries", "cookies" stays. */
const plural = (w: string) =>
  /s$/.test(w) ? w : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + "ies" : /(ch|sh|x)$/.test(w) ? w + "es" : w + "s";

/** The noun the model chose for the counted thing picks its picture. */
const ICON_WORDS: [RegExp, World["icon"]][] = [
  [/cookie|biscuit|cracker|snack/i, "cookie"],
  [/honey/i, "honeypot"],
  [/ball/i, "ball"],
  [/apple|fruit|berr|cherr|melon|orange|banana/i, "apple"],
  [/carriage|wagon|coach/i, "carriage"],
  [/car\b|cars|truck|bus|vehicle/i, "car"],
  [/flower|daisy|rose|petal/i, "flower"],
  [/candy|sweet|lollipop|chocolate|treat/i, "candy"],
  [/egg/i, "egg"],
  [/shell|pearl/i, "shell"],
  [/block|brick|lego|cube|box/i, "block"],
  [/star/i, "star"],
];

/** Light colours vanish on a cream background; pull them down. */
const visible = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.8 ? shade(hex, 0.35) : hex;
};

/** A known show keeps its hand-made world; anything else starts from Pooh's. */
function baseWorld(p: ChildProfile): World {
  return WORLDS[p.world === "custom" ? worldForShow(p.favouriteShow) : p.world];
}

export function fallbackCharacter(p: ChildProfile): Character {
  const w = baseWorld(p);
  return {
    name: w.hero,
    world: w.id,
    body: p.colourSensitive ? "#9a9a9a" : w.colours.body,
    accent: p.colourSensitive ? "#5f5f5f" : w.colours.accent,
    accessory: w.id === "honey" ? "none" : "scarf",
    catchphrase: w.id === "honey" ? "One pot at a time." : "We count together.",
    treasure: w.treasure,
    source: "fallback",
    skin: w,
  };
}

/**
 * Pooh is the default and stays hand-drawn. Any other show — including ones
 * no list could anticipate — is turned into a world by the model: who the
 * hero is, which body to draw, what gets counted, the jar, the colours and
 * the beads. Every field is checked against what the app can actually draw.
 */
export async function designCharacter(p: ChildProfile): Promise<Character> {
  const base = fallbackCharacter(p);
  const show = p.likesStories ? p.favouriteShow.trim() : "";
  // What to draw is the caregiver's pick. With no stories, it is Pooh.
  const buddy = paintBuddy(buddyById(p.likesStories ? p.buddy : "bear"), p.likesStories ? p.buddyColour : undefined);
  const plainPooh = buddy.id === "bear" && (!show || /pooh|winnie/i.test(show));
  if (plainPooh) return polishCharacter(p, { ...base, ...fromWorld(p, WORLDS.honey) });
  // A hand-made world with no show named: that world, dressed by the model.
  if (buddy.world && !show) return polishCharacter(p, { ...base, ...fromWorld(p, WORLDS[buddy.world]) });

  const start = buddyWorld(buddy);
  const user = JSON.stringify({
    favourite_show: show.slice(0, 40) || null,
    the_character_is: buddy.kind,
    child_age: p.age,
  });
  // A small model breaks its JSON now and then; one retry fixes most of it.
  let obj: Record<string, unknown> | null = null;
  for (let i = 0; i < 2 && !obj; i++) obj = (await askJson(CHARACTER_SYSTEM, user, CHARACTER_BUDGET_MS, 220)).obj;
  // Still nothing: the child named a show, so they get that show's name on
  // a plain world — never Pooh standing in for it.
  obj ??= { hero_name: show ? show.split(/\s+/).slice(0, 2).join(" ") : buddy.label };
  const fromModel = Object.keys(obj).length > 1;

  // The body colour is the caregiver's (or the character's own); the model,
  // which cannot see the show, only picks the accessory colour.
  const main = start.colours.body;
  let accent = visible(typeof obj.accent_colour === "string" && HEX.test(obj.accent_colour) ? obj.accent_colour.toLowerCase() : start.colours.accent);
  if (accent === main) accent = shade(main, 0.35);
  // Nothing from Pooh's world leaks in: an unusable answer becomes stars.
  const many0 = noun(obj.items);
  const one = noun(obj.item) || (many0 ? many0.replace(/s$/, "") : start.item.one);
  const many = many0 && many0 !== one ? many0 : plural(one);
  const heroIs = buddy.kind;
  const pictured = ICON_WORDS.find(([re]) => re.test(many))?.[1];
  const name = typeof obj.hero_name === "string" ? obj.hero_name.trim().replace(/[^\p{L} '-]/gu, "") : "";
  const heroName = name && countWords(name) <= 2 ? name : show ? show.split(/\s+/).slice(0, 2).join(" ") : buddy.label;
  const catchphrase = typeof obj.catchphrase === "string" ? obj.catchphrase.trim() : "";
  const bead = BEADS.includes(obj.bead as never) ? (obj.bead as World["bead"]) : start.bead;
  const hundreds = shade(accent, 0.25);

  const skin: World = {
    id: "custom",
    label: show || buddy.label,
    hero: heroName,
    heroKind: heroIs,
    item: { one, many },
    treasure: one,
    jar: ((j) => (!j || j === one || j === many ? `${one} jar` : j))(noun(obj.jar, 2)),
    takeVerb: VERBS.includes(String(obj.take_verb)) ? String(obj.take_verb) : "gives away",
    bead,
    // Drawn as the caregiver picked, whatever the model thinks the show looks like.
    body: buddy.id,
    icon: pictured ?? (ICONS.includes(obj.item_icon as never) ? (obj.item_icon as World["icon"]) : start.icon),
    colours: {
      body: main,
      accent,
      bead: main,
      beadEdge: shade(main),
      tens: accent,
      tensEdge: shade(accent),
      hundreds,
      hundredsEdge: shade(hundreds),
      fill: main,
      sky: tint(main, 0.86),
      ground: tint(accent, 0.7),
    },
  };

  return {
    name: heroName,
    world: "custom",
    body: p.colourSensitive ? "#9a9a9a" : main,
    accent: p.colourSensitive ? "#5f5f5f" : accent,
    accessory: ACCESSORIES.includes(obj.accessory as never) ? (obj.accessory as Character["accessory"]) : "none",
    catchphrase: catchphrase && countWords(catchphrase) <= 8 && !/[!?]/.test(catchphrase) ? catchphrase : "We count together.",
    treasure: one,
    source: fromModel ? "model" : "fallback",
    skin,
  };
}

const POLISH_SYSTEM = `You dress a friendly companion character for a young child's maths app.
Reply with one JSON object and nothing else, with exactly these keys:
{"accent": "#rrggbb", "accessory": string, "catchphrase": string}
- accent: a soft, warm colour for the accessory.
- accessory: one of none, scarf, hat, bow, cap.
- catchphrase: at most 8 calm, literal words about the character. No exclamation marks, no questions.`;

/** Pooh keeps his name and his colour; the model only dresses him. */
async function polishCharacter(p: ChildProfile, base: Character): Promise<Character> {
  const user = JSON.stringify({ character: base.name, character_is: base.skin?.heroKind, child_age: p.age });
  const { obj } = await askJson(POLISH_SYSTEM, user, CHARACTER_BUDGET_MS, 80);
  if (!obj) return base;
  const catchphrase = typeof obj.catchphrase === "string" ? obj.catchphrase.trim() : "";
  return {
    ...base,
    accent:
      !p.colourSensitive && typeof obj.accent === "string" && HEX.test(obj.accent) && obj.accent.toLowerCase() !== base.body.toLowerCase()
        ? obj.accent
        : base.accent,
    accessory: ACCESSORIES.includes(obj.accessory as never) ? (obj.accessory as Character["accessory"]) : base.accessory,
    catchphrase: catchphrase && countWords(catchphrase) <= 8 && !/[!?]/.test(catchphrase) ? catchphrase : base.catchphrase,
    source: "model",
  };
}

// ---------- 2. the next question ----------
//
// Two short calls rather than one long one: a 1.5B model follows a small,
// example-led prompt well and a layered rule list badly (measured: the
// combined prompt produced a usable story 0 times in 3). So the model first
// picks skill + level + focus, the engine picks the numbers, and then the
// model writes one sentence around numbers it is handed.

const PLAN_SYSTEM = `You are a patient maths teacher for a young autistic child. You decide the next question.
You get how the child is doing on each skill, their recent answers, and a list of options.
Decide like a good teacher:
- Right on the first try, several times in a row: go harder, or move to a new skill.
- Right, but only on the second try: stay at the same level.
- A mistake: go easier, or review the skill underneath.
- Pictures, then dots, then numbers only: when pictures are easy, try the same as dots; when dots are easy, numbers only.
- Keep it varied: after a few questions on one skill, move to a skill in "not_practised_lately".
Reply with JSON only: {"reason": "<one short sentence about this child>", "choice": "<one option letter>"}`;

/**
 * The story line, sized to how the child communicates: one short sentence
 * for a child using a few words, two fuller sentences for a child who reads
 * and speaks in sentences. Each line continues the session's story.
 */
function storySystem(sentences: 1 | 2, maxWords: number): string {
  const shape = sentences === 2 ? `Two short sentences, at most ${maxWords} words in total` : `One short sentence, at most ${maxWords} words`;
  return `You write the next line of a calm story for a young child doing maths.
${shape}. Continue "Today's story" if one is given.
Use exactly the numbers you are given, written as digits, and no other numbers. Present tense. Plain, literal words.
No question. No exclamation mark. Reply with the story line only.
Examples
Character: Tilly the engine. Things: carriages. Today's story: Tilly is taking toys to the fair. Maths: start with 5 carriages. 2 more arrive.
Line: ${sentences === 2 ? "Tilly pulls 5 carriages full of toys to the fair. At the bridge, 2 more carriages join the train." : "Tilly pulls 5 carriages, and 2 more carriages join."}
Character: Rexy. Things: dino eggs. Today's story: Rexy is looking after the nest. Maths: dino eggs to count. Write no numbers.
Line: ${sentences === 2 ? "Rexy checks the warm nest before bedtime. The dino eggs sit in a neat row." : "Rexy finds dino eggs in the nest."}`;
}

const PREMISE_SYSTEM = `You start a calm, simple story for a young child's maths session.
Write one sentence, at most 14 words, about what the character is doing today.
Plain, literal words. Present tense. No numbers, no question, no exclamation mark.
Example: Tilly the engine is taking toys to the fair.
Reply with the sentence only.`;

/**
 * What the story line should describe, in words the model can follow, and
 * what it must mention. A line about cookies above "How long is the
 * stick?" is on-theme and useless: the story has to set up this question.
 */
function scene(q: Question, w: World): { maths: string; numbers: number[]; mustMention?: RegExp } {
  const v = q.visual;
  const thing = w.item.many.split(" ").pop() ?? w.item.many;
  const aboutItems = new RegExp(`\\b${thing.replace(/s$/, "")}`, "i");
  if (v.kind === "sum" || (v.kind === "items" && v.op)) {
    const [a, b, op] = v.kind === "sum" ? [v.a, v.b, v.op] : [v.groups[0], v.groups[1], v.op!];
    return op === "+"
      ? { maths: `start with ${a} ${w.item.many}. ${b} more arrive.`, numbers: [a, b], mustMention: aboutItems }
      : { maths: `start with ${a} ${w.item.many}. The character ${w.takeVerb} ${b}.`, numbers: [a, b], mustMention: aboutItems };
  }
  if (v.kind === "build") return { maths: `the character wants exactly ${v.value} ${w.item.many}.`, numbers: [v.value], mustMention: aboutItems };
  const noNumbers: Record<string, { maths: string; must: RegExp }> = {
    items: { maths: `the character lines up ${w.item.many} to count. Mention the ${w.item.many}. Write no numbers.`, must: aboutItems },
    compare: { maths: `the character makes two piles of ${w.item.many}. Mention the two piles. Write no numbers.`, must: /\bpiles?\b/i },
    numeral: { maths: "the character holds up a number card. Mention the number card. Write no numbers.", must: /\b(number|card)\b/i },
    shape: { maths: "the character finds a shape. Mention the shape, but do not name it. Write no numbers.", must: /\bshape\b/i },
    clock: { maths: "the character looks at the clock to see the time. Mention the clock. Write no numbers.", must: /\bclock\b/i },
    coins: { maths: "the character counts coins to buy a treat. Mention the coins. Write no numbers.", must: /\bcoins?\b/i },
    ruler: { maths: "the character measures a stick with a ruler. Mention the stick and the ruler. Write no numbers.", must: /\b(stick|ruler)\b/i },
  };
  const n = noNumbers[v.kind];
  return { maths: n?.maths ?? "a maths puzzle. Write no numbers.", numbers: [], mustMention: n?.must };
}

/**
 * A story line is accepted only if it carries exactly the question's
 * numbers — no fewer (the child could not solve it), no more (a stray
 * number is a wrong answer waiting to happen, or the answer itself).
 */
export function validateStory(raw: unknown, numbers: number[], shapeName?: string, maxWords = 16, mustMention?: RegExp): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim().replace(/^["'“]|["'”]$/g, "").replace(/^sentence:\s*/i, "").replace(/\s+/g, " ");
  // Small models like to append "How many are left?". Keep what comes before it.
  const cut = s.search(/[^.]*\?/);
  if (cut >= 0) s = s.slice(0, cut).trim();
  s = s.replace(/^line:\s*/i, "");
  if (!s || /[!?]/.test(s) || countWords(s) > maxWords + 2 || countWords(s) < 3) return null;
  const found = (s.match(/\d+/g) ?? []).map(Number);
  if (found.length !== numbers.length) return null;
  if ([...found].sort().join() !== [...numbers].sort().join()) return null;
  if (shapeName && new RegExp(shapeName, "i").test(s)) return null;
  if (mustMention && !mustMention.test(s)) return null;
  for (const [re] of BANNED_PATTERNS) {
    if (re.source.includes("it|they") || re.source.includes("\\?")) continue;
    if (re.test(s)) return null;
  }
  if (!/[.]$/.test(s)) s += ".";
  return s;
}

export interface PlanResult {
  plan: Plan;
  /** A validated story line for the question the plan produces, if the model wrote one. */
  story?: string;
  provider: string;
  latencyMs: number;
}

export async function planNext(
  p: ChildProfile,
  model: LearnerModel,
  history: Attempt[],
  heroName: string,
  seed: string,
  world: World = WORLDS.honey,
  premise?: string
): Promise<PlanResult> {
  const t0 = Date.now();
  const rules = rulePlan(p, model, history);
  const provider = (await resolveProvider()).id;
  let plan = rules;
  if (p.adaptConsent && provider !== "none") {
    const options = planOptions(p, model, history);
    // Letters are shuffled per question, so a habit of picking "A" (or the
    // option that looks like an example) cannot steer the child anywhere.
    const r = rng(hashSeed(seed));
    const letters = r.shuffle("ABCDEFGH".slice(0, options.length).split(""));
    const menu = Object.fromEntries(
      options.map((o, i) => [letters[i], o.label.replace(o.skill, SKILL_LABEL[o.skill])])
    );
    const user = JSON.stringify({
      child: { age: p.age, support_needed: p.support },
      how_it_is_going: summarise(history),
      not_practised_lately: gradeSkills(p).filter((sk) => !history.slice(-10).some((a) => a.skill === sk)).map((sk) => SKILL_LABEL[sk]),
      skills: skillStats(p, model, history).map((st) => ({ ...st, skill: SKILL_LABEL[st.skill] })),
      recent_answers: history.slice(-5).map((a) => ({
        skill: SKILL_LABEL[a.skill],
        level: a.level,
        result: a.correct ? (a.tries === 1 ? "right first try" : "right on second try") : "missed",
        shown_as: REP_LADDER[a.skill] ? REP_LABEL[a.rep ?? "C"] : undefined,
        mistake: a.mistake === "none" ? undefined : MISTAKE_TEXT[a.mistake],
      })),
      options: Object.fromEntries(Object.entries(menu).sort()),
    });
    const { obj } = await askJson(PLAN_SYSTEM, user, PLAN_BUDGET_MS, 90);
    const letter = typeof obj?.choice === "string" ? obj.choice.trim().toUpperCase().replace(/[^A-H]/g, "").slice(0, 1) : "";
    const idx = letters.indexOf(letter);
    if (idx >= 0) {
      let reason = typeof obj?.reason === "string" ? obj.reason.trim() : "";
      // The reason is shown to the grown-up. A small model sometimes invents
      // ("easily distracted") or contradicts the record ("struggling" after
      // five right answers); those are replaced with what was actually chosen.
      const contradicts = /struggl|distract|difficult|not ready|trouble/i.test(reason) && !history.slice(-2).some((a) => !a.correct || a.tries > 1);
      if (!reason || contradicts || countWords(reason) > 30 || BANNED_CLINICAL.some((re) => re.test(reason)) || /\b(struggl|distract)/i.test(reason) || /_|\b(option|json|list)\b/i.test(reason))
        reason = `Model chose: ${menu[letter]}.`;
      plan = planFromOption(options[idx], reason, history[history.length - 1]);
    }
  }

  // The story is written for every child who likes stories, with or without
  // adaptation consent: it changes the words, never the maths.
  let story: string | undefined;
  if (provider !== "none" && p.likesStories) {
    const w = world;
    const q = generateQuestion({ skill: plan.skill, level: plan.level, seed, world: w, hero: heroName });
    const sc = scene(q, w);
    const size = storyWordsFor(p);
    const today = premise ? ` Today's story: ${premise}` : "";
    const user = `Character: ${heroName}. Things: ${w.item.many}.${today} Maths: ${sc.maths.replace("The character", heroName)}\nLine:`;
    const pr = await resolveProvider();
    const deadline = Date.now() + STORY_BUDGET_MS;
    // Two tries: a rejected sentence costs ~0.5 s, and the template is always there.
    for (let i = 0; i < 2 && !story && Date.now() < deadline; i++) {
      const raw = await withBudget(
        pr.complete({ system: storySystem(size.sentences, size.max), user, maxTokens: size.sentences === 2 ? 80 : 50, temperature: 0.5 + i * 0.2 }),
        deadline - Date.now()
      );
      // Small models like to paste the opening line back in first; the child has already read it.
      const trimmed = premise && typeof raw === "string" ? raw.replace(premise, "").trim() : raw;
      story = validateStory(trimmed, sc.numbers, q.visual.kind === "shape" ? q.visual.shape : undefined, size.max, sc.mustMention) ?? undefined;
      // The opening line is not on screen any more: "He" has to be a name.
      if (story) story = story.replace(/^(He|She|They)\b/, heroName);
    }
  }

  return { plan, story, provider: plan.source === "model" || story ? provider : "rules", latencyMs: Date.now() - t0 };
}

/** One plain sentence about the recent run, which a small model reads far better than a table. */
function summarise(history: Attempt[]): string {
  const last = history[history.length - 1];
  if (!last) return "This is the first question.";
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const a = history[i];
    if (a.skill !== last.skill || !a.correct || a.tries > 1) break;
    streak++;
  }
  const name = SKILL_LABEL[last.skill];
  if (streak >= 2) return `The child got the last ${streak} questions on ${name} right on the first try, up to level ${last.level}. That is easy for them now.`;
  if (streak === 1) return `The child got the last question on ${name} (level ${last.level}) right on the first try.`;
  if (last.correct) return `The child got the last question on ${name} (level ${last.level}) right, but only on the second try.`;
  return `The child missed the last question on ${name} at level ${last.level}: ${MISTAKE_TEXT[last.mistake]}.`;
}

// ---------- the session's story ----------

/** One opening line that the session's five puzzles continue. Null when the model is away. */
export async function sessionPremise(p: ChildProfile, world: World, hero: string): Promise<string | null> {
  if (!p.likesStories) return null;
  const pr = await resolveProvider();
  if (pr.id === "none") return null;
  const user = `Character: ${hero}. Things they like: ${world.item.many}.\nSentence:`;
  for (let i = 0; i < 2; i++) {
    const raw = await withBudget(pr.complete({ system: PREMISE_SYSTEM, user, maxTokens: 40, temperature: 0.8 }), 5000);
    const s = validateStory(raw, [], undefined, 12);
    if (s && !/[()]/.test(s)) return s;
  }
  return null;
}

// ---------- 3. after the session ----------

const REVIEW_EXAMPLE_NAME = "Alex";

const REVIEW_SYSTEM = `You write a short progress note for the parent of a child using a maths app.
You get facts about one session. Use only these facts. Reply with JSON only.
Example facts:
{"child_name": "Alex", "skills": [{"skill": "Counting", "first_try": 2, "second_try": 0, "shown_answer": 0}, {"skill": "Shapes", "first_try": 0, "second_try": 1, "shown_answer": 1, "slips": ["picked the square for the rectangle"]}]}
Example reply:
{"strengths": ["Counting"], "working_on": ["Shapes"], "note": "Alex counted well today. Telling squares from rectangles is the next thing to practise."}
Rules:
- A skill with any second_try or shown_answer goes in working_on, never in strengths.
- strengths and working_on use the skill names exactly as given.
- note: two short, kind, plain sentences about THIS child's facts, using their name. Say what went well and what to practise next. No medical words, no words like struggles or problems, no promises.`;

export async function reviewSession(
  p: ChildProfile,
  model: LearnerModel,
  attempts: Attempt[]
): Promise<LearnerModel> {
  const rules = ruleReview(model, attempts);
  // Without consent the levels stay where they were: the app does not reorient itself.
  if (!p.adaptConsent) return { ...rules, levels: model.levels, source: "rules" };

  // Facts, not raw answers: a 1.5B model summarises counts far more
  // faithfully than it tallies a list itself.
  const skills = [...new Set(attempts.map((a) => a.skill))].map((s) => {
    const as = attempts.filter((a) => a.skill === s);
    const slips = [...new Set(as.filter((a) => a.mistake !== "none").map((a) => MISTAKE_TEXT[a.mistake]))];
    return {
      skill: SKILL_LABEL[s],
      first_try: as.filter((a) => a.correct && a.tries === 1).length,
      second_try: as.filter((a) => a.correct && a.tries > 1).length,
      shown_answer: as.filter((a) => !a.correct).length,
      ...(slips.length ? { slips } : {}),
    };
  });
  const user = JSON.stringify({ child_name: p.name || "Your child", skills });
  const res = await askJson(REVIEW_SYSTEM, user, REVIEW_BUDGET_MS, 200);
  // A small model sometimes answers with just the note. That is still the note.
  const obj = res.obj ?? (res.raw && !res.raw.includes("{") ? { note: res.raw } : null);
  if (!obj) return rules;

  let note = typeof obj.note === "string" ? obj.note.trim() : "";
  for (const s of ALL_SKILLS) note = note.replaceAll(s, SKILL_LABEL[s].toLowerCase());
  let noteOk =
    !!note &&
    countWords(note) <= 50 &&
    !BANNED_CLINICAL.some((re) => re.test(note)) &&
    // An echo of the prompt's example is not a note about this child.
    (p.name === REVIEW_EXAMPLE_NAME || !note.includes(REVIEW_EXAMPLE_NAME)) &&
    !/squares from rectangles/i.test(note);

  if (noteOk && !noteMatchesFacts(note, rules.strengths, rules.workingOn)) noteOk = false;
  // Deficit framing ("struggles", "issues") and garbled words ("countinging") read badly to a parent.
  if (noteOk && /\b(struggl\w*|issues?|problems?|difficult\w*|fail\w*|poor\w*|weak\w*)\b|(\w{2,})\2\b|ing(ing|ed)\b/i.test(note)) noteOk = false;

  return {
    // Levels and the two lists are facts, computed by the rules; they are what
    // the next question is built from. The model's part is the note.
    levels: rules.levels,
    reps: rules.reps,
    strengths: rules.strengths,
    workingOn: rules.workingOn,
    note: noteOk ? note : factNote(p.name, attempts, rules.strengths, rules.workingOn),
    sessions: rules.sessions,
    updatedAt: Date.now(),
    source: noteOk ? "model" : "rules",
  };
}

// ---------- keeping the note honest ----------

const PRAISE = /\b(good|well|great|strong|confident|solid|easily)\b/i;
const NEXT = /\b(practi[sc]e|next|work on|working on|needs?|tricky|harder)\b/i;

/**
 * The everyday words a note might use for a skill. "Did well with
 * addition" is about the adding skills even though it never says
 * "Adding within 1000" — which is how a contradiction slipped through.
 */
const SKILL_WORDS: Record<SkillId, RegExp> = {
  count: /\bcount(ing|s|ed)?\b/i,
  recognise: /\brecogni[sz]\w*|number names?\b/i,
  compare: /\b(more and less|more or less|compar\w*|bigger|smaller|fewer)\b/i,
  add10: /\b(add(ing|ition|s|ed)?|plus|sums?)\b/i,
  add20: /\b(add(ing|ition|s|ed)?|plus|sums?)\b/i,
  add1000: /\b(add(ing|ition|s|ed)?|plus|sums?|carry\w*)\b/i,
  sub10: /\b(subtract\w*|tak(e|ing) away|minus|take-away)\b/i,
  sub20: /\b(subtract\w*|tak(e|ing) away|minus|take-away)\b/i,
  sub1000: /\b(subtract\w*|tak(e|ing) away|minus|take-away|borrow\w*)\b/i,
  shapes: /\bshapes?\b/i,
  placeValue100: /\b(place value|tens and ones)\b/i,
  placeValue1000: /\b(place value|hundreds)\b/i,
  timeHour: /\b(time|clocks?|o'clock|hours?)\b/i,
  money: /\b(money|coins?|cents?)\b/i,
  measure: /\b(measur\w*|rulers?|length|long|centimet\w*)\b/i,
};

/** A skill is mentioned by its name or by an everyday word for it. */
const mentions = (sentence: string, skill: SkillId) =>
  sentence.toLowerCase().includes(SKILL_LABEL[skill].toLowerCase()) || SKILL_WORDS[skill].test(sentence);

/**
 * A small model will happily write "good at adding" about the skill the
 * child missed. Each sentence is checked against the facts: praise may only
 * name strengths, and "next to practise" may only name skills being worked on.
 */
export function noteMatchesFacts(note: string, strengths: SkillId[], workingOn: SkillId[]): boolean {
  for (const sentence of note.split(/(?<=[.!])\s+/)) {
    const praises = PRAISE.test(sentence);
    const flags = NEXT.test(sentence);
    if (praises && !flags && workingOn.some((sk) => mentions(sentence, sk))) return false;
    if (flags && !praises && strengths.some((sk) => mentions(sentence, sk))) return false;
  }
  return true;
}

/** The deterministic note, written from the same facts. */
export function factNote(name: string, attempts: Attempt[], strengths: SkillId[], workingOn: SkillId[]): string {
  const who = name || "Your child";
  const first = attempts.filter((a) => a.correct && a.tries === 1).length;
  const parts = [`${who} solved ${first} of ${attempts.length} puzzles on the first try.`];
  const list = (xs: SkillId[]) => xs.map((x) => SKILL_LABEL[x].toLowerCase()).join(" and ");
  if (strengths.length) parts.push(`Comfortable today: ${list(strengths)}.`);
  if (workingOn.length) parts.push(`Next to practise: ${list(workingOn)}.`);
  return parts.join(" ");
}

/** A character that simply lives in a given world, before the model dresses it. */
function fromWorld(p: ChildProfile, w: World): Partial<Character> {
  return {
    name: w.hero,
    world: w.id,
    body: p.colourSensitive ? "#9a9a9a" : w.colours.body,
    accent: p.colourSensitive ? "#5f5f5f" : w.colours.accent,
    accessory: w.id === "honey" ? "none" : "scarf",
    catchphrase: w.id === "honey" ? "One pot at a time." : "We count together.",
    treasure: w.treasure,
    skin: w,
  };
}

// ---------- a guess at an answer the rules could not explain ----------

const GUESS_SYSTEM = `A child answered a maths question in a way we cannot explain.
Suggest, in one short sentence, what the child might have been thinking.
Start with "Maybe". Be kind and plain. No diagnosis words. No numbers other than the ones given.
Reply with the sentence only.`;

/**
 * Surface C from the architecture: shown to the grown-up, labelled as a
 * guess, and never used to choose a puzzle.
 */
export async function guessAnswer(q: Question, given: string): Promise<string | null> {
  const pr = await resolveProvider();
  if (pr.id === "none") return null;
  const shown =
    q.visual.kind === "sum" ? `${q.visual.a} ${q.visual.op} ${q.visual.b}`
    : q.visual.kind === "items" ? q.visual.groups.join(q.visual.op ? ` ${q.visual.op} ` : " and ")
    : q.visual.kind === "coins" ? `${q.visual.coins.length} coins: ${q.visual.coins.join(", ")} cents`
    : q.visual.kind === "clock" ? `a clock showing ${q.visual.hour} o'clock`
    : q.visual.kind === "ruler" ? `a stick ${q.visual.length} cm long`
    : q.visual.kind;
  const label = (id: string) => q.choices.find((c) => c.id === id)?.label ?? id;
  const user = JSON.stringify({ skill: SKILL_LABEL[q.skill], question: q.ask, shown, right_answer: label(q.answer), child_answered: label(given) });
  const raw = await withBudget(pr.complete({ system: GUESS_SYSTEM, user, maxTokens: 60, temperature: 0.4 }), 8000);
  if (typeof raw !== "string") return null;
  const t = raw.trim().replace(/^["']|["']$/g, "").split(/(?<=[.])\s/)[0];
  if (!/^(maybe|perhaps|possibly)\b/i.test(t) || countWords(t) > 28 || BANNED_CLINICAL.some((re) => re.test(t))) return null;
  // A guess may only use numbers the child actually saw or gave.
  const known = new Set([...(shown.match(/\d+/g) ?? []), ...(label(q.answer).match(/\d+/g) ?? []), ...(label(given).match(/\d+/g) ?? [])]);
  if ((t.match(/\d+/g) ?? []).some((n) => !known.has(n))) return null;
  // "added 42 and 25 instead of 42 and 25" says nothing.
  const inst = t.match(/(.+?) instead of (.+?)[.]?$/i);
  if (inst && inst[1].split(" ").slice(-4).join(" ").replace(/^.*?(\d)/, "$1") === inst[2].replace(/^.*?(\d)/, "$1")) return null;
  return t;
}
