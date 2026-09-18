"use client";

// ============================================================
// What sits above the question. Everything here is drawn from the
// engine's numbers; nothing the model wrote reaches this file.
//
// `annot` is how the demo "plays": it lights items one at a time, crosses
// them out, reveals a carry. The same components render the child's turn
// with no annotation at all, so the demo shows exactly the screen the child
// is about to use.
// ============================================================

import type { ShapeId, Visual } from "@/lib/learn/types";
import type { World } from "@/lib/learn/worlds";

import { ItemIcon } from "./Items";

export interface Annot {
  /** How many items (across groups, left to right) are lit so far. */
  lit?: number;
  /** A running count shown next to the lit items. */
  counter?: number;
  /** How many of the take-away items are crossed out so far (default: all). */
  gone?: number;
  /** Column arithmetic: which columns have been worked, from the right. */
  worked?: number;
  /** Coins: how many are counted so far. */
  coinsCounted?: number;
  /** Clock / ruler: show the reading guide. */
  guide?: boolean;
}

/** Tap-to-count: the order the child touched items in, and how to add one. */
export interface Counting {
  marks: number[];
  onMark: (index: number) => void;
}

function ItemGrid({
  n,
  world,
  offset = 0,
  lit = 0,
  goneFrom = Infinity,
  size,
  counting,
  dots = false,
}: {
  n: number;
  world: World;
  offset?: number;
  lit?: number;
  goneFrom?: number;
  size: number;
  counting?: Counting;
  /** Representational: plain dots instead of pictures of things. */
  dots?: boolean;
}) {
  const Thing = ({ state }: { state: "on" | "gone" | "lit" }) =>
    dots ? <Dot world={world} size={size} state={state} /> : <ItemIcon world={world} size={size} state={state} />;
  // Past 20, draw bundles of ten: nobody counts 47 honey pots one by one.
  if (n > 20) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return (
      <div className="flex flex-wrap items-end justify-center gap-2">
        {Array.from({ length: tens }).map((_, t) => (
          <div
            key={t}
            className="grid grid-cols-2 gap-0.5 rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] p-1"
            style={{ outline: lit > t * 10 ? "3px solid var(--glow-strong)" : undefined }}
          >
            {Array.from({ length: 10 }).map((_, i) => (
              <ItemIcon key={i} world={world} size={16} />
            ))}
          </div>
        ))}
        {Array.from({ length: ones }).map((_, i) => (
          <ItemIcon key={`o${i}`} world={world} size={size} state={lit > tens * 10 + i ? "lit" : "on"} />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-5 justify-items-center gap-1.5">
      {Array.from({ length: n }).map((_, i) => {
        const idx = offset + i;
        const gone = idx >= goneFrom;
        const mark = counting ? counting.marks.indexOf(idx) : -1;
        const state = gone ? "gone" : idx < lit || mark >= 0 ? "lit" : "on";
        if (!counting || gone) return <Thing key={i} state={state} />;
        return (
          <button
            key={i}
            type="button"
            onClick={() => counting.onMark(idx)}
            className="count-item"
            aria-label={mark >= 0 ? `counted ${mark + 1}` : "tap to count"}
          >
            <Thing state={state} />
            {mark >= 0 && <span className="count-badge">{mark + 1}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** A plain counter: the "representational" step between things and numerals. */
function Dot({ world, size, state }: { world: World; size: number; state: "on" | "gone" | "lit" }) {
  const r = size * 0.32;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ opacity: state === "gone" ? 0.25 : 1, transition: "all 260ms ease" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill={state === "lit" ? "var(--glow-strong)" : world.colours.bead} stroke={world.colours.beadEdge} strokeWidth="2" />
      {state === "gone" && <path d={`M${size * 0.2} ${size * 0.2} L${size * 0.8} ${size * 0.8}`} stroke="var(--ink-soft)" strokeWidth="3" strokeLinecap="round" />}
    </svg>
  );
}

/** Abstract: the same question, numbers only. */
function Equation({ a, b, op }: { a: number; b?: number; op?: "+" | "-" }) {
  return (
    <div className="flex items-center gap-4 rounded-3xl border-4 border-[var(--line)] bg-[var(--surface)] px-8 py-4 font-display text-6xl font-bold tabular-nums" role="img" aria-label={op ? `${a} ${op === "+" ? "plus" : "minus"} ${b}` : String(a)}>
      <span>{a}</span>
      {op && (
        <>
          <span className="text-[var(--accent-strong)]">{op === "+" ? "+" : "−"}</span>
          <span>{b}</span>
          <span className="text-[var(--ink-soft)]">=</span>
          <span className="rounded-2xl border-4 border-dashed border-[var(--line)] px-4 text-[var(--ink-soft)]">?</span>
        </>
      )}
    </div>
  );
}

function Shape({ shape, size = 150 }: { shape: ShapeId; size?: number }) {
  const fill = "var(--shape)";
  const stroke = "var(--shape-edge)";
  const p = { fill, stroke, strokeWidth: 4, strokeLinejoin: "round" as const };
  const s: Record<ShapeId, React.ReactNode> = {
    circle: <circle cx="60" cy="60" r="48" {...p} />,
    square: <rect x="14" y="14" width="92" height="92" rx="4" {...p} />,
    rectangle: <rect x="4" y="30" width="112" height="60" rx="4" {...p} />,
    triangle: <path d="M60 10 L112 104 H8 Z" {...p} />,
    star: <path d="M60 6 l14 32 34 3 -26 22 8 34 -30 -18 -30 18 8 -34 -26 -22 34 -3 z" {...p} />,
    hexagon: <path d="M60 8 L106 34 V86 L60 112 L14 86 V34 Z" {...p} />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="a shape">
      {s[shape]}
    </svg>
  );
}

function Clock({ hour, guide }: { hour: number; guide?: boolean }) {
  const a = ((hour % 12) / 12) * 2 * Math.PI;
  const hx = 100 + Math.sin(a) * 42;
  const hy = 100 - Math.cos(a) * 42;
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" role="img" aria-label="a clock">
      <circle cx="100" cy="100" r="92" fill="var(--surface)" stroke="var(--ink)" strokeWidth="6" />
      {Array.from({ length: 12 }).map((_, i) => {
        const t = ((i + 1) / 12) * 2 * Math.PI;
        const lit = guide && i + 1 === (hour % 12 || 12);
        return (
          <text
            key={i}
            x={100 + Math.sin(t) * 72}
            y={100 - Math.cos(t) * 72 + 8}
            textAnchor="middle"
            fontSize={lit ? 26 : 22}
            fontWeight={lit ? 800 : 600}
            fill={lit ? "var(--hot)" : "var(--ink)"}
            fontFamily="var(--font-display)"
          >
            {i + 1}
          </text>
        );
      })}
      {/* minute hand at 12 */}
      <line x1="100" y1="100" x2="100" y2="30" stroke="var(--ink-soft)" strokeWidth="6" strokeLinecap="round" />
      {/* hour hand */}
      <line x1="100" y1="100" x2={hx} y2={hy} stroke={guide ? "var(--hot)" : "var(--ink)"} strokeWidth="10" strokeLinecap="round" />
      <circle cx="100" cy="100" r="7" fill="var(--ink)" />
    </svg>
  );
}

const COIN: Record<number, { r: number; fill: string; label: string }> = {
  1: { r: 22, fill: "#c98a5a", label: "1¢" },
  5: { r: 26, fill: "#c9ccd2", label: "5¢" },
  10: { r: 20, fill: "#dfe2e8", label: "10¢" },
  25: { r: 30, fill: "#d4d7dd", label: "25¢" },
};

function Coins({ coins, counted = 0 }: { coins: number[]; counted?: number }) {
  const totals = coins.map((_, i) => coins.slice(0, i + 1).reduce((s, c) => s + c, 0));
  return (
    <div className="flex flex-wrap items-end justify-center gap-3">
      {coins.map((c, i) => {
        const running = totals[i];
        const k = COIN[c];
        const lit = i < counted;
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <svg width={k.r * 2 + 6} height={k.r * 2 + 6} viewBox={`0 0 ${k.r * 2 + 6} ${k.r * 2 + 6}`} aria-label={`${c} cent coin`}>
              <circle cx={k.r + 3} cy={k.r + 3} r={k.r} fill={k.fill} stroke={lit ? "var(--hot)" : "#8a8f99"} strokeWidth={lit ? 4 : 2} />
              <text x={k.r + 3} y={k.r + 9} textAnchor="middle" fontSize={k.r > 24 ? 16 : 14} fontWeight="800" fill="#2a2a2a" fontFamily="var(--font-display)">
                {k.label}
              </text>
            </svg>
            <span className={`h-6 text-sm font-bold tabular-nums ${lit ? "text-[var(--hot)]" : "opacity-0"}`}>{running}¢</span>
          </div>
        );
      })}
    </div>
  );
}

function Ruler({ length, world, guide }: { length: number; world: World; guide?: boolean }) {
  const cm = 22;
  const max = Math.max(10, length + 2);
  const c = world.colours;
  return (
    <svg width={max * cm + 40} height="120" viewBox={`0 0 ${max * cm + 40} 120`} className="max-w-full" role="img" aria-label="a stick beside a ruler">
      <rect x="20" y="16" width={length * cm} height="22" rx="6" fill={c.tens} stroke={c.tensEdge} strokeWidth="2" />
      <rect x="10" y="52" width={max * cm + 20} height="50" rx="6" fill="#f7e7b4" stroke="#b89a4a" strokeWidth="2" />
      {Array.from({ length: max + 1 }).map((_, i) => (
        <g key={i}>
          <line x1={20 + i * cm} x2={20 + i * cm} y1="52" y2={i % 5 === 0 ? 72 : 66} stroke="#5a4a20" strokeWidth="2" />
          <text x={20 + i * cm} y="94" textAnchor="middle" fontSize="13" fontWeight={guide && i === length ? 800 : 600} fill={guide && i === length ? "var(--hot)" : "#5a4a20"}>
            {i}
          </text>
        </g>
      ))}
      {guide && (
        <line x1={20 + length * cm} x2={20 + length * cm} y1="8" y2="80" stroke="var(--hot)" strokeWidth="3" strokeDasharray="5 4" />
      )}
    </svg>
  );
}

/** Column arithmetic, laid out the way it is written on paper, carries included. */
function ColumnSum({ a, b, op, worked = 0 }: { a: number; b: number; op: "+" | "-"; worked?: number }) {
  const width = Math.max(String(a).length, String(b).length, String(op === "+" ? a + b : a - b).length);
  const digits = (n: number) => String(n).padStart(width, " ").split("");
  const da = digits(a);
  const db = digits(b);
  // Carries / borrows, per column from the right.
  const marks: string[] = Array(width).fill("");
  if (op === "+") {
    let carry = 0;
    for (let i = width - 1; i >= 0; i--) {
      const s = (Number(da[i]) || 0) + (Number(db[i]) || 0) + carry;
      carry = s >= 10 ? 1 : 0;
      if (carry && i > 0) marks[i - 1] = "1";
    }
  } else {
    let borrow = 0;
    for (let i = width - 1; i >= 0; i--) {
      const top = (Number(da[i]) || 0) - borrow;
      const bot = Number(db[i]) || 0;
      borrow = top < bot ? 1 : 0;
      if (borrow) marks[i] = String(top + 10);
    }
  }
  const result = digits(op === "+" ? a + b : a - b);
  const cell = "w-12 text-center";
  return (
    <div className="font-display text-5xl font-bold tabular-nums leading-tight" role="img" aria-label={`${a} ${op === "+" ? "plus" : "minus"} ${b}`}>
      <div className="flex justify-end pr-1 text-xl text-[var(--hot)]">
        <span className="w-12" />
        {marks.map((m, i) => (
          <span key={i} className={cell} style={{ opacity: worked >= width - i ? 1 : 0 }}>
            {m}
          </span>
        ))}
      </div>
      <div className="flex justify-end">
        <span className="w-12" />
        {da.map((d, i) => <span key={i} className={cell}>{d}</span>)}
      </div>
      <div className="flex justify-end border-b-4 border-[var(--ink)] pb-1">
        <span className={`${cell} text-[var(--accent-strong)]`}>{op === "+" ? "+" : "−"}</span>
        {db.map((d, i) => <span key={i} className={cell}>{d}</span>)}
      </div>
      <div className="flex justify-end text-[var(--accent-strong)]">
        <span className="w-12" />
        {result.map((d, i) => (
          <span key={i} className={cell} style={{ opacity: worked >= width - i ? 1 : 0, transition: "opacity 300ms" }}>
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}

export function VisualView({
  visual,
  world,
  annot = {},
  counting,
}: {
  visual: Visual;
  world: World;
  annot?: Annot;
  counting?: Counting;
}) {
  const size = 38;
  switch (visual.kind) {
    case "items": {
      const [a, b] = visual.groups;
      const r = visual.rep ?? "C";
      if (r === "A") return <Equation a={a} b={b} op={visual.op} />;
      const dots = r === "R";
      if (visual.op === "+" && b !== undefined) {
        return (
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="item-tray"><ItemGrid n={a} world={world} lit={annot.lit} size={size} counting={counting} dots={dots} /></div>
            <span className="font-display text-5xl font-bold text-[var(--accent-strong)]">+</span>
            <div className="item-tray"><ItemGrid n={b} world={world} offset={a} lit={annot.lit} size={size} counting={counting} dots={dots} /></div>
            {annot.counter !== undefined && <Counter n={annot.counter} />}
          </div>
        );
      }
      if (visual.op === "-" && b !== undefined) {
        const gone = annot.gone ?? b;
        return (
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="item-tray">
              <ItemGrid n={a} world={world} lit={annot.lit} goneFrom={a - gone} size={size} counting={counting} dots={dots} />
            </div>
            {annot.counter !== undefined && <Counter n={annot.counter} />}
          </div>
        );
      }
      return (
        <div className="flex items-center gap-4">
          <div className="item-tray"><ItemGrid n={a} world={world} lit={annot.lit} size={size} counting={counting} dots={dots} /></div>
          {annot.counter !== undefined && <Counter n={annot.counter} />}
        </div>
      );
    }
    case "compare":
      return null; // the two piles are the choices themselves
    case "numeral":
      return null; // the number word is the ask; the numerals are the choices
    case "shape":
      return <Shape shape={visual.shape} />;
    case "clock":
      return <Clock hour={visual.hour} guide={annot.guide} />;
    case "coins":
      return <Coins coins={visual.coins} counted={annot.coinsCounted} />;
    case "ruler":
      return <Ruler length={visual.length} world={world} guide={annot.guide} />;
    case "sum":
      return <ColumnSum a={visual.a} b={visual.b} op={visual.op} worked={annot.worked} />;
    case "build":
      return (
        <div className="rounded-3xl border-4 border-dashed border-[var(--line)] bg-[var(--surface)] px-10 py-4 font-display text-7xl font-bold tabular-nums">
          {visual.value}
        </div>
      );
  }
}

function Counter({ n }: { n: number }) {
  return (
    <span className="grid h-16 w-16 place-items-center rounded-full bg-[var(--hot)] font-display text-3xl font-bold text-white shadow-lg" aria-live="polite">
      {n}
    </span>
  );
}

/** A small rendering of a visual for inside a choice button (the compare piles). */
export function MiniVisual({ visual, world }: { visual: Visual; world: World }) {
  if (visual.kind !== "items") return null;
  if (visual.rep === "A") return <span className="font-display text-5xl font-bold tabular-nums">{visual.groups[0]}</span>;
  return <ItemGrid n={visual.groups[0]} world={world} size={28} dots={visual.rep === "R"} />;
}
