// ============================================================
// The question engine. Deterministic: same (skill, level, seed) → same
// question. Every number and every correct answer comes from here; the
// model only ever supplies the story around them.
// ============================================================

import { REP_LADDER } from "./curriculum";
import type { Choice, Level, Question, Rep, ShapeId, SkillId, Visual } from "./types";
import { STORY_TEMPLATES, fillTemplate, type World } from "./worlds";

// ---------- seeded randomness ----------

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)];
  const shuffle = <T,>(xs: readonly T[]): T[] => {
    const out = [...xs];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  return { next, int, pick, shuffle };
}

type R = ReturnType<typeof rng>;

// ---------- helpers ----------

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

export function numberWord(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : "");
  if (n < 1000) {
    const rest = n % 100;
    return ONES[Math.floor(n / 100)] + " hundred" + (rest ? " and " + numberWord(rest) : "");
  }
  return String(n);
}

const reverseDigits = (n: number) => Number(String(n).split("").reverse().join(""));

/** Column-wise sum with every carry dropped: 27 + 15 → 32. */
export const addNoCarry = (a: number, b: number) => {
  let out = 0;
  for (let p = 1; p <= Math.max(a, b); p *= 10) {
    out += ((Math.floor(a / p) % 10 + Math.floor(b / p) % 10) % 10) * p;
  }
  return out;
};

/** Column-wise "smaller from bigger": 42 − 17 → 35. The classic borrowing slip. */
export const subNoBorrow = (a: number, b: number) => {
  let out = 0;
  for (let p = 1; p <= a; p *= 10) {
    out += Math.abs(Math.floor(a / p) % 10 - Math.floor(b / p) % 10) * p;
  }
  return out;
};

/** Four numeric choices: the answer plus the likeliest wrong answers, all ≥ 0. */
function numericChoices(r: R, answer: number, likely: number[], spread = 2): Choice[] {
  const set = new Set<number>([answer]);
  for (const x of likely) if (x >= 0 && x !== answer && set.size < 4) set.add(x);
  let d = 1;
  while (set.size < 4) {
    const cand = answer + (r.next() < 0.5 ? -d : d);
    if (cand >= 0) set.add(cand);
    d = d >= spread ? 1 + Math.floor(r.next() * (spread + 2)) : d + 1;
  }
  return r.shuffle([...set]).map((n) => ({ id: String(n), label: String(n) }));
}

// ---------- per-skill builders ----------

interface Built {
  visual: Visual;
  ask: string;
  mode: Question["mode"];
  choices: Choice[];
  answer: string;
  nums: { a?: number; b?: number; n?: number };
  columns?: Question["columns"];
}

type Builder = (r: R, level: Level, w: World) => Built;

const ranges = <T,>(level: Level, xs: [T, T, T, T, T]): T => xs[level - 1];

const count: Builder = (r, level, w) => {
  const [lo, hi] = ranges(level, [[1, 5], [3, 10], [6, 15], [11, 20], [21, 60]]);
  const n = r.int(lo, hi);
  return {
    visual: { kind: "items", groups: [n] },
    ask: `How many ${w.item.many}?`,
    mode: "choices",
    choices: numericChoices(r, n, [n - 1, n + 1]),
    answer: String(n),
    nums: { n },
  };
};

const recognise: Builder = (r, level) => {
  const [lo, hi] = ranges(level, [[1, 10], [5, 20], [11, 20], [21, 60], [21, 99]]);
  let n = r.int(lo, hi);
  if (level >= 4 && n % 10 === Math.floor(n / 10)) n += 1; // keep the reversal distinct
  const likely = [reverseDigits(n), n + 10, n - 10, n + 1].filter((x) => x > 0 && x < 100);
  return {
    visual: { kind: "numeral", value: n },
    ask: `Find the number ${numberWord(n)}.`,
    mode: "choices",
    choices: numericChoices(r, n, likely),
    answer: String(n),
    nums: { n },
  };
};

const compare: Builder = (r, level, w) => {
  const [maxN, minGap] = ranges(level, [[5, 3], [8, 2], [10, 2], [15, 1], [20, 1]]);
  const a = r.int(1, maxN - minGap);
  const b = Math.min(maxN, a + r.int(minGap, Math.max(minGap, 3)));
  const [left, right] = r.next() < 0.5 ? [a, b] : [b, a];
  const askMore = level < 3 || r.next() < 0.6;
  const answer = (askMore ? left > right : left < right) ? "left" : "right";
  return {
    visual: { kind: "compare", left, right },
    ask: askMore ? `Which pile has more ${w.item.many}?` : `Which pile has fewer ${w.item.many}?`,
    mode: "choices",
    choices: [
      { id: "left", label: "This one", visual: { kind: "items", groups: [left] } },
      { id: "right", label: "This one", visual: { kind: "items", groups: [right] } },
    ],
    answer,
    nums: { a: left, b: right },
  };
};

function addBuilder(maxSum: [number, number, number, number, number], abacusFrom: Level): Builder {
  return (r, level, w) => {
    const max = ranges(level, maxSum);
    const a = r.int(1, Math.max(1, max - 1));
    const b = r.int(1, Math.max(1, max - a));
    const sum = a + b;
    const abacus = level >= abacusFrom;
    return {
      visual: sum <= 20 ? { kind: "items", groups: [a, b], op: "+" } : { kind: "sum", a, b, op: "+" },
      ask: `How many ${w.item.many} now?`,
      mode: abacus ? "abacus" : "choices",
      columns: abacus ? ["tens", "ones"] : undefined,
      choices: abacus ? [] : numericChoices(r, sum, [sum - 1, sum + 1, Math.abs(a - b)]),
      answer: String(sum),
      nums: { a, b },
    };
  };
}

function subBuilder(maxStart: [number, number, number, number, number], abacusFrom: Level): Builder {
  return (r, level, w) => {
    const max = ranges(level, maxStart);
    const a = r.int(Math.min(3, max), max);
    const b = r.int(1, a - 1);
    const diff = a - b;
    const abacus = level >= abacusFrom;
    return {
      visual: a <= 20 ? { kind: "items", groups: [a, b], op: "-" } : { kind: "sum", a, b, op: "-" },
      ask: `How many ${w.item.many} are left?`,
      mode: abacus ? "abacus" : "choices",
      columns: abacus ? ["tens", "ones"] : undefined,
      choices: abacus ? [] : numericChoices(r, diff, [diff + 1, diff - 1, a + b]),
      answer: String(diff),
      nums: { a, b },
    };
  };
}

const add20: Builder = (r, level, w) => {
  // Level 3 and up bridge ten on purpose: 8 + 5 is the whole point of this band.
  const bridge = level >= 3;
  let a: number, b: number;
  if (bridge) {
    a = r.int(ranges(level, [6, 6, 6, 7, 9]), 9);
    b = r.int(11 - a, Math.min(9, 20 - a));
  } else {
    a = r.int(2, level === 1 ? 6 : 8);
    // Level 2 adds to a teen without reaching the next ten: 13 + 4, not 13 + 7.
    b = r.int(1, level === 1 ? 10 - a : 9 - a);
    if (level === 2) a += 10;
  }
  const sum = a + b;
  const abacus = level >= 4;
  return {
    visual: { kind: "items", groups: [a, b], op: "+" },
    ask: `How many ${w.item.many} now?`,
    mode: abacus ? "abacus" : "choices",
    columns: abacus ? ["tens", "ones"] : undefined,
    choices: abacus ? [] : numericChoices(r, sum, [sum - 1, sum + 1, addNoCarry(a, b)]),
    answer: String(sum),
    nums: { a, b },
  };
};

const sub20: Builder = (r, level, w) => {
  const bridge = level >= 3;
  let a: number, b: number;
  if (bridge) {
    a = r.int(11, ranges(level, [15, 15, 15, 18, 19]));
    b = r.int((a % 10) + 1, 9);
  } else {
    a = level === 1 ? r.int(5, 10) : r.int(13, 19);
    b = r.int(1, level === 1 ? a - 1 : a % 10);
  }
  const diff = a - b;
  const abacus = level >= 4;
  return {
    visual: { kind: "items", groups: [a, b], op: "-" },
    ask: `How many ${w.item.many} are left?`,
    mode: abacus ? "abacus" : "choices",
    columns: abacus ? ["tens", "ones"] : undefined,
    choices: abacus ? [] : numericChoices(r, diff, [diff + 1, diff - 1, subNoBorrow(a, b)]),
    answer: String(diff),
    nums: { a, b },
  };
};

const shapes: Builder = (r, level) => {
  const pool: ShapeId[] = ranges(level, [
    ["circle", "square", "triangle"],
    ["circle", "square", "triangle", "rectangle"],
    ["circle", "square", "triangle", "rectangle", "star"],
    ["circle", "square", "triangle", "rectangle", "star", "hexagon"],
    ["circle", "square", "triangle", "rectangle", "star", "hexagon"],
  ]);
  const shape = r.pick(pool);
  const others = r.shuffle(pool.filter((s) => s !== shape)).slice(0, Math.min(3, pool.length - 1));
  // Square and rectangle side by side is the useful confusion from level 2.
  if (shape === "square" && pool.includes("rectangle") && !others.includes("rectangle")) others[0] = "rectangle";
  return {
    visual: { kind: "shape", shape },
    ask: "What shape is this?",
    mode: "choices",
    choices: r.shuffle([shape, ...others]).map((s) => ({ id: s, label: s })),
    answer: shape,
    nums: {},
  };
};

const placeValue = (max: 100 | 1000): Builder => (r, level) => {
  let n: number;
  if (max === 100) {
    const [lo, hi] = ranges(level, [[10, 20], [11, 40], [21, 99], [11, 99], [51, 99]]);
    n = r.int(lo, hi);
    if (level >= 4 && n % 10 === 0) n += r.int(1, 9);
  } else {
    n = ranges(level, [
      r.int(1, 9) * 100,
      r.int(1, 9) * 100 + r.int(1, 9) * 10,
      r.int(101, 999),
      r.int(1, 9) * 100 + r.int(1, 9), // a zero in the tens: 405
      r.int(101, 999),
    ]);
  }
  return {
    visual: { kind: "build", value: n },
    ask: `Show ${n} on the beads.`,
    mode: "abacus",
    columns: max === 100 ? ["tens", "ones"] : ["hundreds", "tens", "ones"],
    choices: [],
    answer: String(n),
    nums: { n },
  };
};

const timeHour: Builder = (r, level) => {
  const hour = level <= 2 ? r.pick([12, 3, 6, 9]) : r.int(1, 12);
  const label = (h: number) => `${h} o'clock`;
  const near = [((hour % 12) + 1) || 12, ((hour + 10) % 12) + 1, 12].filter((h) => h !== hour);
  const set = new Set([hour, ...near]);
  while (set.size < 4) set.add(r.int(1, 12));
  return {
    visual: { kind: "clock", hour },
    ask: "What time does the clock show?",
    mode: "choices",
    choices: r.shuffle([...set].slice(0, 4)).map((h) => ({ id: String(h), label: label(h) })),
    answer: String(hour),
    nums: { n: hour },
  };
};

const add1000: Builder = (r, level, w) => {
  let a: number, b: number;
  switch (level) {
    case 1: a = r.int(21, 85); b = r.int(1, 9 - (a % 10)) ; break;
    case 2: a = r.int(21, 64); b = r.int(11, 35); if ((a % 10) + (b % 10) >= 10) b -= (b % 10); break;
    case 3: a = r.int(15, 69); b = r.int(10 - (a % 10) + 10, 29); break;
    case 4: a = r.int(120, 480); b = r.int(15, 89); break;
    default: a = r.int(150, 560); b = r.int(150, 430);
  }
  if (b < 1) b = 1;
  const sum = a + b;
  return {
    visual: { kind: "sum", a, b, op: "+" },
    ask: `How many ${w.item.many} altogether?`,
    mode: "abacus",
    columns: sum >= 100 ? ["hundreds", "tens", "ones"] : ["tens", "ones"],
    choices: [],
    answer: String(sum),
    nums: { a, b },
  };
};

const sub1000: Builder = (r, level, w) => {
  let a: number, b: number;
  switch (level) {
    case 1: a = r.int(25, 98); b = r.int(1, a % 10 || 1); break;
    case 2: a = r.int(45, 98); b = r.int(11, 40); if (b % 10 > a % 10) b -= (b % 10) - (a % 10); break;
    case 3: a = r.int(31, 92); b = r.int(12, a - 10); if (b % 10 <= a % 10) b = Math.min(a - 1, b + (a % 10) - (b % 10) + 1); break;
    case 4: a = r.int(210, 690); b = r.int(18, 89); break;
    default: a = r.int(402, 950); b = r.int(125, 395);
  }
  b = Math.max(1, Math.min(b, a - 1));
  const diff = a - b;
  return {
    visual: { kind: "sum", a, b, op: "-" },
    ask: `How many ${w.item.many} are left?`,
    mode: "abacus",
    columns: a >= 100 ? ["hundreds", "tens", "ones"] : ["tens", "ones"],
    choices: [],
    answer: String(diff),
    nums: { a, b },
  };
};

const money: Builder = (r, level) => {
  const kinds = ranges(level, [[1], [5, 1], [10, 5, 1], [25, 10, 5, 1], [25, 25, 10, 5, 1]]);
  const n = ranges(level, [r.int(2, 6), r.int(2, 5), r.int(3, 5), r.int(3, 5), r.int(4, 6)]);
  const coins = Array.from({ length: n }, () => r.pick(kinds)).sort((x, y) => y - x);
  const total = coins.reduce((s, c) => s + c, 0);
  const ch = numericChoices(r, total, [total - 1, total + 5, total - 5, coins.length], 5);
  return {
    visual: { kind: "coins", coins },
    ask: "How many cents are the coins worth?",
    mode: "choices",
    choices: ch.map((c) => ({ ...c, label: `${c.label}¢` })),
    answer: String(total),
    nums: { n: total },
  };
};

const measure: Builder = (r, level) => {
  const length = r.int(...ranges<[number, number]>(level, [[2, 5], [3, 8], [4, 10], [6, 12], [8, 15]]));
  const ch = numericChoices(r, length, [length + 1, length - 1]);
  return {
    visual: { kind: "ruler", length },
    ask: "How long is the stick, in centimetres?",
    mode: "choices",
    choices: ch.map((c) => ({ ...c, label: `${c.label} cm` })),
    answer: String(length),
    nums: { n: length },
  };
};

const BUILDERS: Record<SkillId, Builder> = {
  count,
  recognise,
  compare,
  add10: addBuilder([5, 6, 8, 10, 10], 6 as Level),
  sub10: subBuilder([5, 6, 8, 10, 10], 6 as Level),
  shapes,
  add20,
  sub20,
  placeValue100: placeValue(100),
  timeHour,
  add1000,
  sub1000,
  placeValue1000: placeValue(1000),
  money,
  measure,
};

// ---------- the public entry point ----------

export interface GenerateInput {
  skill: SkillId;
  level: Level;
  seed: string;
  world: World;
  hero: string;
  /** A validated, already-filled story line from the model, if there is one. */
  story?: string;
  /** How to show it. Ignored by skills without a picture → dots → numbers ladder. */
  rep?: Rep;
}

export function generateQuestion(input: GenerateInput): Question {
  const r = rng(hashSeed(`${input.seed}:${input.skill}:${input.level}`));
  const b = BUILDERS[input.skill](r, input.level, input.world);

  // Drawn even when unused, so the model's story never shifts the numbers.
  const template = r.pick(STORY_TEMPLATES[input.skill]);
  const story = input.story ?? fillTemplate(template, input.world, input.hero, b.nums);

  const ladder = REP_LADDER[input.skill];
  const rep: Rep = ladder && input.rep && ladder.includes(input.rep) ? input.rep : "C";
  // The numbers never change with the representation; only the drawing does.
  const visual: Visual = b.visual.kind === "items" || b.visual.kind === "compare" ? { ...b.visual, rep } : b.visual;
  const choices = b.choices.map((c) => (c.visual?.kind === "items" ? { ...c, visual: { ...c.visual, rep } } : c));

  return {
    id: `${input.seed}-${input.skill}-${input.level}-${rep}`,
    skill: input.skill,
    level: input.level,
    story,
    ask: b.ask,
    visual,
    mode: b.mode,
    choices,
    answer: b.answer,
    columns: b.columns,
    storySource: input.story ? "model" : "template",
    rep,
  };
}
