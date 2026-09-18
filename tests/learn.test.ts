import assert from "node:assert/strict";
import { test } from "node:test";

import { factNote, noteMatchesFacts, validateStory } from "../lib/learn/ai";
import { ALL_SKILLS } from "../lib/learn/curriculum";
import { diagnose } from "../lib/learn/diagnose";
import { generateQuestion } from "../lib/learn/generate";
import { guardPlan, initialModel, planOptions, rulePlan, ruleReview } from "../lib/learn/policy";
import type { Attempt, ChildProfile, Level } from "../lib/learn/types";
import { WORLDS, worldForShow } from "../lib/learn/worlds";

const profile: ChildProfile = {
  name: "Sam",
  age: 6,
  grade: "G1",
  support: "some",
  communication: "phrases",
  colourSensitive: false,
  soundSensitive: false,
  likesStories: true,
  favouriteShow: "Winnie the Pooh",
  world: "honey",
  cheer: "woohoo",
  adaptConsent: true,
  createdAt: 0,
};

const attempt = (over: Partial<Attempt>): Attempt => ({
  questionId: "q",
  skill: "add20",
  level: 3,
  correct: true,
  given: "",
  expected: "",
  mistake: "none",
  tries: 1,
  ms: 1000,
  at: 0,
  ...over,
});

test("every skill × level × 200 seeds yields a solvable, well-formed question", () => {
  for (const skill of ALL_SKILLS) {
    for (const level of [1, 2, 3, 4, 5] as Level[]) {
      for (let i = 0; i < 200; i++) {
        const q = generateQuestion({ skill, level, seed: `s${i}`, world: WORLDS.honey, hero: "Pooh" });
        const where = `${skill} L${level} s${i}`;
        assert.ok(q.story.length > 0, where);
        assert.ok(!/\{[a-z]+\}/.test(q.story), `unfilled slot: ${where} → ${q.story}`);
        if (q.mode === "choices") {
          assert.ok(q.choices.some((c) => c.id === q.answer), `answer missing from choices: ${where}`);
          assert.equal(new Set(q.choices.map((c) => c.id)).size, q.choices.length, `duplicate choice: ${where}`);
        } else {
          const n = Number(q.answer);
          const cap = q.columns?.includes("hundreds") ? 999 : 99;
          assert.ok(Number.isInteger(n) && n >= 0 && n <= cap, `abacus answer out of range: ${where} → ${n}`);
        }
        if (q.visual.kind === "sum" || (q.visual.kind === "items" && q.visual.op)) {
          const [a, b, op] =
            q.visual.kind === "sum" ? [q.visual.a, q.visual.b, q.visual.op] : [q.visual.groups[0], q.visual.groups[1], q.visual.op];
          assert.equal(Number(q.answer), op === "+" ? a + b : a - b, where);
          assert.ok(a > 0 && b > 0 && (op === "+" || a > b), `bad operands: ${where}`);
        }
      }
    }
  }
});

test("the same seed gives the same question", () => {
  const a = generateQuestion({ skill: "sub1000", level: 4, seed: "x", world: WORLDS.trains, hero: "Tilly" });
  const b = generateQuestion({ skill: "sub1000", level: 4, seed: "x", world: WORLDS.trains, hero: "Tilly" });
  assert.deepEqual(a, b);
});

test("diagnose names the common slips", () => {
  const q = generateQuestion({ skill: "add1000", level: 3, seed: "d", world: WORLDS.honey, hero: "Pooh" });
  assert.equal(q.visual.kind, "sum");
  if (q.visual.kind !== "sum") return;
  const { a, b } = q.visual;
  assert.equal(diagnose(q, q.answer), "none");
  assert.equal(diagnose(q, String(a - b)), "wrong-operation");
  assert.equal(diagnose(q, String(Number(q.answer) + 1)), "off-by-one");
});

test("worlds: Pooh is the default, shows map to their setting", () => {
  assert.equal(worldForShow(""), "honey");
  assert.equal(worldForShow("Winnie the Pooh"), "honey");
  assert.equal(worldForShow("Thomas & Friends"), "trains");
  assert.equal(worldForShow("Octonauts"), "ocean");
});

test("rules: wrong answer → same skill, one level easier; at level 1 → prerequisite", () => {
  const m = initialModel(profile);
  const down = rulePlan(profile, m, [attempt({ correct: false, level: 3, mistake: "regrouping" })]);
  assert.deepEqual([down.skill, down.level], ["add20", 2]);
  const back = rulePlan(profile, m, [attempt({ correct: false, level: 1 })]);
  assert.equal(back.skill, "add10");
});

test("guard: the model may never go harder straight after a miss, or leave the band", () => {
  const history = [attempt({ correct: false, level: 3 })];
  const fallback = rulePlan(profile, initialModel(profile), history);
  const harder = guardPlan({ skill: "add20", level: 5 }, profile, history, fallback);
  assert.ok(harder.level < 3);
  const offBand = guardPlan({ skill: "money", level: 1 }, profile, history, fallback);
  assert.equal(offBand.source, "rules");
  const noConsent = guardPlan({ skill: "add20", level: 1 }, { ...profile, adaptConsent: false }, history, fallback);
  assert.equal(noConsent.source, "rules");
});

test("model stories must carry exactly the question's numbers", () => {
  assert.equal(validateStory("Pooh has 7 honey pots and eats 3.", [7, 3]), "Pooh has 7 honey pots and eats 3.");
  assert.equal(validateStory("Pooh has 7 pots and eats 3. How many are left?", [7, 3]), "Pooh has 7 pots and eats 3.");
  assert.equal(validateStory("Pooh has 7 pots and eats 3 and 1 more.", [7, 3]), null, "stray number");
  assert.equal(validateStory("Pooh has 7 pots.", [7, 3]), null, "missing number");
  assert.equal(validateStory("Pooh lines up 6 pots.", []), null, "a count story may not give the answer away");
  assert.equal(validateStory("Pooh does not eat 7 or 3 pots.", [7, 3]), null, "negation");
  assert.equal(validateStory("Pooh has 7 pots! He eats 3.", [7, 3]), null, "exclamation");
  assert.equal(validateStory("Pooh finds a round circle in the sand.", [], "circle"), null, "names the shape");
});

test("guard: after a miss the same skill must get easier, even if the model keeps the level", () => {
  const history = [attempt({ correct: false, level: 3 })];
  const fallback = rulePlan(profile, initialModel(profile), history);
  assert.equal(guardPlan({ skill: "add20", level: 3 }, profile, history, fallback).level, 2);
});

test("review rules: a miss lowers the level, a second-try solve holds it, first-try solves raise it", () => {
  const m = initialModel(profile); // every G1 skill at 2
  const r = ruleReview(m, [
    attempt({ skill: "add20", level: 2, correct: false, mistake: "regrouping", tries: 2 }),
    attempt({ skill: "sub20", level: 2, correct: true, tries: 2, mistake: "off-by-one" }),
    attempt({ skill: "placeValue100", level: 3, correct: true }),
  ]);
  assert.equal(r.levels.add20, 1);
  assert.equal(r.levels.sub20, 2);
  assert.equal(r.levels.placeValue100, 3);
  assert.deepEqual(r.strengths, ["placeValue100"]);
});

test("add within 20, level 2, never reaches the next ten", () => {
  for (let i = 0; i < 300; i++) {
    const q = generateQuestion({ skill: "add20", level: 2, seed: `t${i}`, world: WORLDS.honey, hero: "Pooh" });
    assert.ok(Number(q.answer) < 20 && Number(q.answer) > 10, q.answer);
  }
});

test("review notes that contradict the facts are rejected", () => {
  assert.equal(noteMatchesFacts("Sam is good at adding within 20. Taking away within 10 is next.", ["sub10"], ["add20"]), false);
  assert.equal(noteMatchesFacts("Sam took away within 10 well. Adding within 20 is next to practise.", ["sub10"], ["add20"]), true);
  assert.match(factNote("Sam", [attempt({ correct: true })], ["add20"], []), /Sam solved 1 of 1/);
});

test("guard: review skills from the band below only after a slip", () => {
  const fallback = rulePlan(profile, initialModel(profile), []);
  assert.equal(guardPlan({ skill: "add10", level: 2 }, profile, [], fallback).source, "rules");
  const slip = [attempt({ skill: "add20", level: 1, correct: false })];
  assert.equal(guardPlan({ skill: "add10", level: 2 }, profile, slip, fallback).source, "model");
});

test("a child who keeps answering right first time climbs and moves on (rules alone)", () => {
  let model = initialModel(profile);
  const all: Attempt[] = [];
  for (let s = 0; s < 3; s++) {
    const sess: Attempt[] = [];
    for (let q = 0; q < 5; q++) {
      const hist = [...all.slice(-6), ...sess];
      // A model that always answers with the old prompt example must not hold the child back.
      const plan = guardPlan({ skill: "add20", level: 2 }, profile, hist, rulePlan(profile, model, hist));
      sess.push(attempt({ skill: plan.skill, level: plan.level, correct: true, tries: 1 }));
    }
    all.push(...sess);
    model = ruleReview(model, sess);
  }
  assert.ok(new Set(all.map((a) => a.skill)).size >= 3, `skills seen: ${[...new Set(all.map((a) => a.skill))]}`);
  assert.ok(Math.max(...all.map((a) => a.level)) >= 4);
  assert.ok((model.levels.add20 ?? 0) >= 4, "a clean session never lowers the saved level");
});

test("menu: only safe steps are ever offered to the model", () => {
  const m = initialModel(profile);
  const afterMiss = planOptions(profile, m, [attempt({ skill: "add20", level: 3, correct: false, tries: 2 })]);
  assert.ok(afterMiss.every((o) => !(o.skill === "add20" && o.level >= 3)), "nothing as hard or harder right after a miss");
  assert.ok(afterMiss.some((o) => o.kind === "review" && o.skill === "add10"), "review is offered after a miss");

  const afterWin = planOptions(profile, m, [attempt({ skill: "add20", level: 3 })]);
  assert.ok(afterWin.every((o) => o.skill !== "add20" || o.level <= 4), "at most one step up");
  assert.ok(afterWin.every((o) => o.kind !== "review"), "no review without a slip");

  const threeEasy = [1, 2, 3].map(() => attempt({ skill: "add20", level: 3 }));
  const afterEasy = planOptions(profile, m, threeEasy);
  assert.ok(!afterEasy.some((o) => o.skill === "add20" && o.level === 3 && o.rep === "C"), "no repeating something plainly easy");
  assert.ok(afterEasy.some((o) => o.kind === "abstract" && o.rep === "R"), "pictures that are easy can become dots");

  const missOnNumbers = planOptions(profile, m, [attempt({ skill: "add20", level: 3, correct: false, rep: "A" })]);
  assert.ok(missOnNumbers.some((o) => o.kind === "concrete" && o.rep === "R"), "a miss on numbers-only can step back to dots");

  const finished = [1, 2, 3].map(() => attempt({ skill: "add20", level: 5 }));
  assert.ok(planOptions(profile, m, finished).every((o) => o.skill !== "add20"), "a finished skill is retired");
});

test("a story must set up its own question", () => {
  assert.equal(validateStory("Shinchan is munching on cookies, enjoying the sweet treat.", [], undefined, 16, /\b(stick|ruler)\b/i), null);
  assert.ok(validateStory("Shinchan lays a long stick next to his ruler.", [], undefined, 16, /\b(stick|ruler)\b/i));
});

test("the representation changes the drawing, never the numbers", () => {
  for (const rep of ["C", "R", "A"] as const) {
    const q = generateQuestion({ skill: "add20", level: 3, seed: "rep", world: WORLDS.honey, hero: "Pooh", rep });
    const base = generateQuestion({ skill: "add20", level: 3, seed: "rep", world: WORLDS.honey, hero: "Pooh" });
    assert.equal(q.answer, base.answer);
    assert.equal(q.rep, rep);
  }
  assert.equal(generateQuestion({ skill: "money", level: 2, seed: "x", world: WORLDS.honey, hero: "Pooh", rep: "A" }).rep, "C", "money has no ladder");
});

test("notes for grown-ups: repeated slips and early breaks are noticed, nothing else is invented", async () => {
  const { computeNotes } = await import("../lib/learn/notes");
  const sess = (id: string, n: number, mistake: Attempt["mistake"] = "none") => ({
    id, startedAt: 0, endedAt: 0, plans: [],
    attempts: Array.from({ length: n }, (_, i) => attempt({ questionId: `${id}${i}`, mistake: i === 0 ? mistake : "none", correct: i !== 0 || mistake === "none" })),
  });
  assert.equal(computeNotes(profile, [sess("a", 5), sess("b", 5), sess("c", 5)]).length, 0, "a good run raises nothing");
  const slips = computeNotes(profile, [sess("a", 5, "regrouping"), sess("b", 5, "regrouping"), sess("c", 5, "regrouping")]);
  assert.ok(slips.some((n) => n.id.startsWith("slip:regrouping")));
  const breaks = computeNotes(profile, [sess("a", 5), sess("b", 2), sess("c", 1)]);
  assert.ok(breaks.some((n) => n.id.startsWith("breaks:")));
});
