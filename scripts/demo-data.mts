/**
 * Sample history for showing the grown-ups page: 10 sessions over three weeks
 * for "Adi", a 1st-grader who loves Shinchan.
 *
 *   npm run demo:data        # writes demo/sample-history.json
 *
 * Grown-ups → Import from JSON loads it. The puzzles, the diagnosis of every
 * slip, the next-puzzle choices, the levels and the notes all come from the
 * app's own code, run on a simulated child whose skills grow a little each
 * session. Only the child is simulated. Deterministic: same file every run.
 */

import { mkdirSync, writeFileSync } from "node:fs";

import { factNote } from "../lib/learn/ai";
import { diagnose } from "../lib/learn/diagnose";
import { generateQuestion, hashSeed, rng } from "../lib/learn/generate";
import { initialModel, planFromOption, planOptions, rulePlan, ruleReview } from "../lib/learn/policy";
import type { Attempt, Character, ChildProfile, Level, Plan, Question, Rep, SessionRecord, SkillId } from "../lib/learn/types";
import { buddyById, buddyWorld, shade, tint } from "../lib/learn/worlds";

const DAY = 86_400_000;
const today = new Date();
today.setHours(16, 30, 0, 0);
const at = (daysAgo: number) => today.getTime() - daysAgo * DAY;

const profile: ChildProfile = {
  name: "Adi",
  age: 6,
  grade: "G1",
  support: "some",
  communication: "sentences",
  colourSensitive: false,
  soundSensitive: false,
  likesStories: true,
  favouriteShow: "Shinchan",
  buddy: "kid",
  buddyColour: "#e0564a",
  world: "custom",
  cheer: "woohoo",
  adaptConsent: true,
  readAloud: "auto",
  createdAt: at(14),
  goals: {
    add20: "Adds within 20, crossing ten, with 80% accuracy",
    sub20: "Takes away within 20 using ten as a stepping stone",
  },
};

const red = "#e0564a";
const base = buddyWorld({ ...buddyById("kid"), body: red, world: undefined });
const world = {
  ...base,
  label: "Shinchan",
  hero: "Shinchan",
  heroKind: "a cheerful young boy",
  item: { one: "cookie", many: "cookies" },
  treasure: "cookie",
  jar: "cookie jar",
  takeVerb: "eats",
  icon: "cookie" as const,
  colours: { ...base.colours, body: red, bead: red, beadEdge: shade(red), fill: red, sky: tint(red, 0.86) },
};
const character: Character = {
  name: "Shinchan",
  world: "custom",
  body: red,
  accent: "#e0a526",
  accessory: "cap",
  catchphrase: "We count together.",
  treasure: "cookie",
  source: "model",
  skin: world,
};

// ---------- the simulated child ----------

const r = rng(hashSeed("adi-sample-history"));
// What Adi can comfortably do, per skill; it grows as a skill is practised.
const ability: Partial<Record<SkillId, number>> = { add20: 2.3, sub20: 1.5, placeValue100: 2.0, timeHour: 2.6, add10: 3.2, sub10: 2.6 };

function firstTryChance(skill: SkillId, level: Level, rep: Rep): number {
  const gap = level - (ability[skill] ?? 2) + (rep === "R" ? 0.3 : rep === "A" ? 0.7 : 0);
  return gap <= 0 ? 0.88 : gap <= 1 ? 0.55 : 0.25;
}

/** Adi's own, recurring slips — the kind the diagnosis should name. */
const TYPICAL: Partial<Record<SkillId, string>> = { sub20: "regrouping", add20: "off-by-one", placeValue100: "digits-swapped" };

function wrongAnswer(q: Question, unexplained = false): string {
  if (q.mode === "choices") {
    const others = q.choices.filter((c) => c.id !== q.answer);
    const want = unexplained ? "guess" : TYPICAL[q.skill];
    const typical = others.find((c) => diagnose(q, c.id) === want);
    return (typical && r.next() < 0.8 ? typical : r.pick(others)).id;
  }
  const n = Number(q.answer);
  // A slip that looks like a real one: off by one, or the digits swapped.
  return r.next() < 0.5 ? String(n + (r.next() < 0.5 ? 1 : -1)) : String(n).split("").reverse().join("");
}

/**
 * Pick the next puzzle from the same safe menu the model gets, the way it
 * tends to: harder after easy wins, easier after a slip, dots or numbers once
 * pictures are easy, and a different skill after a run on one. Labelled
 * "rules" in the file, because no model made these choices.
 */
function choose(history: Attempt[], m: typeof model): Plan {
  const options = planOptions(profile, m, history);
  const last = history[history.length - 1];
  let run = 0;
  for (let i = history.length - 1; i >= 0 && history[i].skill === last?.skill; i--) run++;
  const pick = (kinds: string[]) => options.find((o) => kinds.includes(o.kind));
  const stale = (o: (typeof options)[number]) => !history.slice(-10).some((a) => a.skill === o.skill);
  const o =
    (run >= 3 ? options.find((x) => x.kind === "switch" && stale(x)) ?? pick(["switch"]) : undefined) ??
    (last && !last.correct ? pick(["easier", "concrete", "review"]) : undefined) ??
    (last && last.correct && last.tries === 1 ? pick(r.next() < 0.35 ? ["abstract", "harder"] : ["harder", "abstract"]) : undefined) ??
    pick(["same", "start", "switch"]) ??
    options[0];
  const plan = o ? planFromOption(o, "Chosen from the safe options menu.", last) : rulePlan(profile, m, history);
  return { ...plan, source: "rules" };
}

// ---------- the sessions ----------

const days = [18, 16, 15, 13, 11, 9, 7, 5, 3, 1];
let model = initialModel(profile);
const sessions: SessionRecord[] = [];
let guessed = false;

days.forEach((daysAgo, si) => {
  const start = at(daysAgo) + Math.floor(r.next() * 40) * 60_000;
  const attempts: Attempt[] = [];
  const plans: Plan[] = [];
  // Session 5 ends early: Adi pressed "I need a break" after three puzzles.
  const length = si === 4 ? 3 : 5;
  let clock = start;

  for (let i = 0; i < length; i++) {
    const history = [...sessions.flatMap((s) => s.attempts).slice(-40), ...attempts];
    const plan = choose(history, model);
    const rep: Rep = plan.rep ?? "C";
    const seed = `s${si}-${i}`;
    const q = generateQuestion({ skill: plan.skill, level: plan.level, seed, world, hero: character.name, rep });
    plans.push({ ...plan, rep });

    const right = r.next() < firstTryChance(q.skill, q.level, rep);
    const ms = 4000 + Math.floor(r.next() * (right ? 6000 : 11000));
    clock += ms + 20_000;
    if (right) {
      attempts.push({ questionId: q.id, skill: q.skill, level: q.level, correct: true, given: q.answer, expected: q.answer, mistake: "none", tries: 1, rep: q.rep, ms, at: clock });
      continue;
    }
    // Late on, one slip is one the rules cannot name, so the model is asked to guess.
    const given = wrongAnswer(q, si >= 6 && !guessed);
    const mistake = diagnose(q, given);
    // As in the app, a guess is only asked for when the answer stays wrong.
    const wantsGuess = mistake === "guess" && si >= 6 && !guessed;
    const secondTry = !wantsGuess && r.next() < 0.6;
    const attempt: Attempt = {
      questionId: q.id,
      skill: q.skill,
      level: q.level,
      correct: secondTry,
      given: secondTry ? q.answer : given,
      expected: q.answer,
      mistake,
      tries: 2,
      rep: q.rep,
      ms,
      at: clock,
    };
    // A recent answer the rules could not name gets the kind of guess the model
    // writes, worded for the puzzle it was on.
    if (wantsGuess) {
      guessed = true;
      attempt.hypothesis =
        q.skill === "timeHour"
          ? "Maybe the child read the long hand, which points to 12, instead of the short hand."
          : q.skill === "placeValue100"
            ? "Maybe the child put some of the tens on the ones rod."
            : "Maybe the child counted one group twice.";
    }
    attempts.push(attempt);
  }

  // Practice helps: a little more comfortable with every skill practised today.
  for (const a of attempts) ability[a.skill] = Math.min(5.5, (ability[a.skill] ?? 2) + 0.12);

  sessions.push({ id: `sample-${si + 1}`, startedAt: start, endedAt: clock, attempts, plans });
  model = ruleReview(model, attempts);
  model.note = factNote(profile.name, attempts, model.strengths, model.workingOn);
  model.updatedAt = clock;
});

const out = { app: "tally-tales", sample: true, exportedAt: new Date().toISOString(), profile, character, model, sessions, seenNotes: [] };
mkdirSync("demo", { recursive: true });
writeFileSync("demo/sample-history.json", JSON.stringify(out, null, 2) + "\n");

const all = sessions.flatMap((s) => s.attempts);
console.log(
  `demo/sample-history.json: ${sessions.length} sessions, ${all.length} puzzles, ` +
    `${all.filter((a) => a.correct && a.tries === 1).length} right first time; levels ${JSON.stringify(model.levels)}`
);
