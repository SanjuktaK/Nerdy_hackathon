"use client";

import { useEffect, useMemo, useState } from "react";

import { numberWord } from "@/lib/learn/generate";
import { sfxAway, sfxBead, sfxCoin, sfxCount, sfxTap, sfxTick } from "@/lib/learn/sound";
import type { Question } from "@/lib/learn/types";
import type { World } from "@/lib/learn/worlds";

import { VerticalAbacus, digitsOf, valueOf, type Place } from "./VerticalAbacus";
import { MiniVisual, VisualView, type Annot } from "./Visuals";

// ---------- the card ----------

export interface CardState {
  annot?: Annot;
  /** The choice the demo is "pressing", or the right answer on reveal. */
  selected?: string;
  abacus?: number;
  abacusHighlight?: Place | null;
}

export function QuestionCard({
  q,
  world,
  interactive,
  state = {},
  tried = [],
  onAnswer,
  onSpeak,
  onCount,
}: {
  q: Question;
  world: World;
  interactive: boolean;
  state?: CardState;
  /** Choices already tried and wrong; shown softened and disabled. */
  tried?: string[];
  onAnswer?: (given: string) => void;
  onSpeak?: (text: string) => void;
  /** Called with the running count when the child taps an item. */
  onCount?: (n: number) => void;
}) {
  const [built, setBuilt] = useState(0);
  const [marks, setMarks] = useState<number[]>([]);
  // A little sound of the thing itself when the question appears: coins clink, clocks tick.
  useEffect(() => {
    if (!interactive) return;
    if (q.visual.kind === "coins") sfxCoin();
    if (q.visual.kind === "clock") sfxTick();
  }, [q.id, q.visual.kind, interactive]);
  // Tap-to-count only in the child's own turn, and only where items are drawn one by one.
  const countable =
    interactive && q.visual.kind === "items" && q.visual.rep !== "A" && q.visual.groups.reduce((x, y) => x + y, 0) <= 20;
  const counting = countable
    ? {
        marks,
        onMark: (i: number) => {
          // Tapping a counted item again un-counts it and everything after, like lifting a finger.
          const at = marks.indexOf(i);
          const next = at >= 0 ? marks.slice(0, at) : [...marks, i];
          setMarks(next);
          if (at < 0) {
            sfxCount(next.length);
            onCount?.(next.length);
          }
        },
      }
    : undefined;
  const abacusValue = state.abacus ?? built;
  const cols = (q.columns ?? ["tens", "ones"]) as Place[];

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="flex w-full items-start gap-3">
        <div className="flex-1">
          <p className="font-display text-2xl leading-snug text-[var(--ink)] sm:text-3xl">{q.story}</p>
          <p className="mt-1 font-display text-2xl font-bold text-[var(--accent-strong)] sm:text-3xl">{q.ask}</p>
        </div>
        {onSpeak && (
          <button
            type="button"
            onClick={() => onSpeak(`${q.story} ${q.ask}`)}
            className="speak-btn"
            aria-label="Read it to me"
            title="Read it to me"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
              <path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      <div className="stage flex min-h-[140px] w-full items-center justify-center">
        <VisualView visual={q.visual} world={world} annot={state.annot} counting={counting} />
      </div>
      {countable && (
        <p className="-mt-2 text-sm text-[var(--ink-soft)]">
          Tap each one to count it.{marks.length ? ` Counted: ${marks.length}.` : ""}
        </p>
      )}

      {q.mode === "choices" ? (
        <div className={`grid w-full gap-3 ${q.choices.length === 2 ? "grid-cols-2" : "grid-cols-2"}`}>
          {q.choices.map((c) => {
            const isSel = state.selected === c.id;
            const wasTried = tried.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                disabled={!interactive || wasTried}
                onClick={() => {
                  if (q.visual.kind === "coins") sfxCoin();
                  else sfxTap();
                  onAnswer?.(c.id);
                }}
                className={`choice ${isSel ? "choice-selected" : ""} ${wasTried ? "choice-tried" : ""}`}
              >
                {c.visual ? (
                  <span className="flex flex-col items-center gap-2">
                    <MiniVisual visual={c.visual} world={world} />
                  </span>
                ) : (
                  <span className={q.skill === "shapes" || q.skill === "timeHour" ? "capitalize" : "tabular-nums"}>
                    {c.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <VerticalAbacus
            columns={cols}
            value={abacusValue}
            world={world}
            interactive={interactive}
            highlight={state.abacusHighlight}
            onChange={setBuilt}
          />
          {(interactive || state.selected) && (
            <button
              type="button"
              disabled={!interactive}
              onClick={() => onAnswer?.(String(built))}
              className={`btn-primary ${state.selected ? "choice-selected" : ""}`}
            >
              Check
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- the demo ----------

export interface Frame extends CardState {
  caption: string;
  ms: number;
  /** Say this caption aloud. Only the summary lines, so the demo is not a chatterbox. */
  say?: boolean;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * A scripted walk-through of one question, as a list of frames. Built from
 * the question itself, so every skill gets a demo without a video file.
 */
export function demoFrames(q: Question, hero: string, items: string, pace = 1): Frame[] {
  const f: Frame[] = [];
  const T = (ms: number) => Math.round(ms * pace);
  const push = (caption: string, st: CardState, ms = 1100, say = false) => f.push({ caption, ms: T(ms), say, ...st });
  const final = (caption: string, st: CardState = {}) => push(caption, { ...st, selected: q.answer }, 2200, true);

  f.push({ caption: `Watch ${hero}.`, ms: T(1500), say: true });
  const v = q.visual;

  if (q.mode === "abacus") {
    const target = Number(q.answer);
    if (v.kind === "sum") {
      const width = String(Math.max(v.a, v.b, target)).length;
      const names = ["ones", "tens", "hundreds"];
      for (let w = 1; w <= width; w++) {
        push(`Work the ${names[w - 1]} first, then move left.`, { annot: { worked: w } }, 1500);
      }
    } else if (v.kind === "items") {
      push(`Count them all.`, { annot: { lit: v.groups[0] + (v.op === "+" ? v.groups[1] ?? 0 : 0) } }, 1400);
    }
    const cols = (q.columns ?? ["tens", "ones"]) as Place[];
    const d = digitsOf(target, cols);
    let built: Partial<Record<Place, number>> = {};
    for (const p of cols) {
      for (let k = 1; k <= d[p]; k++) {
        built = { ...built, [p]: k };
        push(`${k} ${k === 1 ? p.slice(0, -1) : p}`, { abacus: valueOf(built), abacusHighlight: p, annot: v.kind === "sum" ? { worked: 9 } : undefined }, 550);
      }
    }
    final(
      cols.map((p) => `${d[p]} ${d[p] === 1 ? p.slice(0, -1) : p}`).join(", ") + ` make ${target}.`,
      { abacus: target, annot: v.kind === "sum" ? { worked: 9 } : undefined }
    );
    return f;
  }

  switch (v.kind) {
    case "items": {
      const [a, b = 0] = v.groups;
      if (v.op === "-") {
        for (let k = 1; k <= b; k++) push(`${hero} takes ${k}.`, { annot: { gone: k } }, 700);
        const left = a - b;
        for (let k = 1; k <= left; k++) push(String(k), { annot: { lit: k, counter: k } }, 520);
        final(`${a} take away ${b} leaves ${left}.`, { annot: { lit: left, counter: left } });
      } else {
        const total = v.op === "+" ? a + b : a;
        if (total > 20) {
          const tens = Math.floor(total / 10);
          for (let t = 1; t <= tens; t++) push(`${t * 10}`, { annot: { lit: t * 10, counter: t * 10 } }, 700);
          for (let k = tens * 10 + 1; k <= total; k++) push(String(k), { annot: { lit: k, counter: k } }, 520);
        } else {
          for (let k = 1; k <= total; k++) push(String(k), { annot: { lit: k, counter: k } }, k === a + 1 && v.op ? 800 : 520);
        }
        final(v.op === "+" ? `${a} and ${b} make ${total}.` : `There are ${total} ${items}.`, { annot: { lit: total, counter: total } });
      }
      break;
    }
    case "compare": {
      const more = q.ask.includes("more");
      push(`This pile has ${v.left}. That pile has ${v.right}.`, {}, 2200, true);
      final(`${Math.max(v.left, v.right)} is more than ${Math.min(v.left, v.right)}. ${cap(more ? "more" : "fewer")} is this one.`);
      break;
    }
    case "numeral":
      final(`${cap(numberWord(v.value))} is written ${String(v.value).split("").join(" ")}.`);
      break;
    case "shape": {
      const facts: Record<string, string> = {
        circle: "It is round, with no corners.",
        square: "It has 4 sides, all the same length.",
        rectangle: "It has 4 sides: 2 long and 2 short.",
        triangle: "It has 3 sides and 3 corners.",
        star: "It has 5 points.",
        hexagon: "It has 6 sides and 6 corners.",
      };
      push(facts[v.shape], {}, 2200, true);
      final(`It is a ${v.shape}.`);
      break;
    }
    case "clock":
      push("Look at the short hand.", { annot: { guide: true } }, 1800, true);
      final(`It points to ${v.hour}. It is ${v.hour} o'clock.`, { annot: { guide: true } });
      break;
    case "coins": {
      let run = 0;
      v.coins.forEach((c, i) => {
        run += c;
        push(`${run} cents`, { annot: { coinsCounted: i + 1 } }, 900);
      });
      final(`That is ${run} cents.`, { annot: { coinsCounted: v.coins.length } });
      break;
    }
    case "ruler":
      push("Start at 0. Look where the stick ends.", { annot: { guide: true } }, 2000, true);
      final(`It ends at ${v.length}. It is ${v.length} centimetres long.`, { annot: { guide: true } });
      break;
    default:
      final("Here is the answer.");
  }
  return f;
}

/**
 * Plays the frames on the real question card, with every control inert.
 * Only "Watch again" and "My turn" work, and only once it has finished.
 */
export function DemoPlayer({
  q,
  world,
  hero,
  items,
  pace,
  onDone,
  onSay,
}: {
  q: Question;
  world: World;
  hero: string;
  items: string;
  pace: number;
  onDone: () => void;
  onSay?: (text: string) => void;
}) {
  const frames = useMemo(() => demoFrames(q, hero, items, pace), [q, hero, items, pace]);
  const [i, setI] = useState(0);
  const [run, setRun] = useState(0);
  const finished = i >= frames.length - 1;

  useEffect(() => {
    // The demo makes the same sounds the child's own actions will.
    const fr = frames[i];
    const pv = frames[i - 1];
    if (fr && pv) {
      if ((fr.abacus ?? 0) !== (pv.abacus ?? 0)) sfxBead(fr.abacusHighlight ?? "ones", (fr.abacus ?? 0) > (pv.abacus ?? 0));
      else if ((fr.annot?.gone ?? 0) > (pv.annot?.gone ?? 0)) sfxAway();
      else if ((fr.annot?.coinsCounted ?? 0) > (pv.annot?.coinsCounted ?? 0)) sfxCoin();
      else if ((fr.annot?.counter ?? 0) > (pv.annot?.counter ?? 0)) sfxCount(fr.annot?.counter ?? 1);
    }
    if (frames[i]?.say) onSay?.(frames[i].caption);
    if (finished) return;
    const t = setTimeout(() => setI((x) => x + 1), frames[i].ms);
    return () => clearTimeout(t);
    // onSay is stable enough; re-running on it would repeat a caption.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, run, frames, finished]);

  const fr = frames[Math.min(i, frames.length - 1)];

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between">
        <span className="watch-badge">
          <span className="rec-dot" aria-hidden="true" /> Watch first
        </span>
        <button type="button" className="skip-btn" onClick={onDone} style={{ order: 3 }}>
          Skip ›
        </button>
        <div className="h-2 flex-1 mx-4 overflow-hidden rounded-full bg-[var(--line)]" aria-hidden="true">
          <div className="h-full rounded-full bg-[var(--accent-strong)] transition-all duration-500" style={{ width: `${((i + 1) / frames.length) * 100}%` }} />
        </div>
      </div>

      <div inert className="demo-frame w-full">
        <QuestionCard q={q} world={world} interactive={false} state={fr} />
      </div>

      <p className="caption" aria-live="polite">{fr.caption}</p>

      <div className="flex gap-3" style={{ visibility: finished ? "visible" : "hidden" }}>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setI(0);
            setRun((r) => r + 1);
          }}
        >
          Watch again
        </button>
        <button type="button" className="btn-primary" onClick={onDone} autoFocus={finished}>
          My turn
        </button>
      </div>
    </div>
  );
}
