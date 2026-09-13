"use client";

// ============================================================
// CRA renderers for the bead frame.
// Same BeadState, three renderings (§4).
//
// The beads are DRAGGED, not clicked. A tap-to-toggle bead is a checkbox
// wearing a circle; the reason manipulatives work is that the hand does
// the arithmetic before the head does, and that needs a continuous gesture.
// Sweep across a rod and the beads come with you.
//
// Three things here are pedagogy, not decoration:
//   · beads group in fives, so "seven" can be seen rather than counted;
//   · a ten bead is drawn as ten visible segments, so "one ten is worth
//     ten ones" is something to look at rather than be told;
//   · the exchange is an act the child performs and watches happen —
//     ten ones gather, cross to the other rod, and arrive as one ten.
//     That single animation is the thing the whole app is about.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ONES_CAPACITY,
  TENS_CAPACITY,
  beadValue,
  canExchange,
  clampBeadState,
  type BeadState,
} from "@/lib/core/bead-frame";
import type { RendererProps } from "@/lib/skills/types";
import { motionMs } from "@/lib/theme";
import { materialsFor, type Material } from "@/lib/theme/materials";

type Slot = "tens" | "ones";

const SLOT_LABEL: Record<Slot, string> = { tens: "Tens", ones: "Ones" };
const GROUP = 5;

const groupsOf = (capacity: number): number[][] => {
  const out: number[][] = [];
  for (let i = 0; i < capacity; i += GROUP) {
    out.push(Array.from({ length: Math.min(GROUP, capacity - i) }, (_, k) => i + k));
  }
  return out;
};

// ---------- the drag gesture ----------

/**
 * A rod tracks the pointer from the moment it goes down until it is
 * released, anywhere on the page. Dragging off the end fills or empties the
 * rod rather than stopping at the last bead the pointer happened to be over,
 * which is what a physical rod does and what a child expects.
 */
function useRodDrag(
  capacity: number,
  interactive: boolean,
  onCount: (n: number) => void
) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const countFromX = useCallback(
    (clientX: number): number => {
      const el = trackRef.current;
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      if (r.width === 0) return 0;
      const ratio = (clientX - r.left) / r.width;
      return Math.max(0, Math.min(capacity, Math.round(ratio * capacity)));
    },
    [capacity]
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      e.preventDefault();
      onCount(countFromX(e.clientX));
    };
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragging, countFromX, onCount]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    e.preventDefault();
    setDragging(true);
    onCount(countFromX(e.clientX));
  };

  return { trackRef, dragging, onPointerDown };
}

// ---------- beads ----------

function TenBead({
  on,
  ghost,
  ms,
  m,
  lifted,
}: {
  on: boolean;
  ghost: boolean;
  ms: number;
  m: Material;
  lifted?: boolean;
}) {
  return (
    <svg
      width="44"
      height="72"
      viewBox="0 0 44 72"
      aria-hidden="true"
      style={{
        transform: lifted ? "scale(1.12)" : "scale(1)",
        transition: ms ? `transform ${ms}ms` : "none",
      }}
    >
      {on && <rect x="7" y="8" width="32" height="60" rx="10" fill={m.edge} opacity="0.22" />}
      <rect
        x="5"
        y="4"
        width="34"
        height="62"
        rx="10"
        fill={on ? m.fill : "transparent"}
        stroke={on ? m.edge : ghost ? m.fill : m.slot}
        strokeWidth={on ? 2 : ghost ? 2.5 : 2}
        strokeDasharray={on ? undefined : "3 4"}
        opacity={on ? 1 : ghost ? 0.85 : 0.3}
        style={{ transition: ms ? `fill ${ms}ms` : "none" }}
      />
      {on && (
        <>
          {Array.from({ length: 9 }).map((_, i) => (
            <line
              key={i}
              x1="5"
              x2="39"
              y1={4 + ((i + 1) * 62) / 10}
              y2={4 + ((i + 1) * 62) / 10}
              stroke={m.shine}
              strokeWidth="2"
              opacity="0.65"
            />
          ))}
          <rect x="9" y="8" width="8" height="16" rx="4" fill={m.shine} opacity="0.7" />
        </>
      )}
    </svg>
  );
}

function OneBead({
  on,
  ghost,
  ms,
  m,
  lifted,
}: {
  on: boolean;
  ghost: boolean;
  ms: number;
  m: Material;
  lifted?: boolean;
}) {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 38 38"
      aria-hidden="true"
      style={{
        transform: lifted ? "scale(1.15)" : "scale(1)",
        transition: ms ? `transform ${ms}ms` : "none",
      }}
    >
      {on && <circle cx="19" cy="21" r="15" fill={m.edge} opacity="0.25" />}
      <circle
        cx="19"
        cy="19"
        r="15"
        fill={on ? m.fill : "transparent"}
        stroke={on ? m.edge : ghost ? m.fill : m.slot}
        strokeWidth={on ? 2 : ghost ? 2.5 : 2}
        strokeDasharray={on ? undefined : "3 4"}
        opacity={on ? 1 : ghost ? 0.85 : 0.3}
        style={{ transition: ms ? `fill ${ms}ms` : "none" }}
      />
      {on && <circle cx="13.5" cy="13.5" r="4.2" fill={m.shine} opacity="0.8" />}
    </svg>
  );
}

// ---------- a rod ----------

function Rod({
  slot,
  count,
  capacity,
  hint,
  interactive,
  ms,
  m,
  onCount,
  bead: Bead,
  leaving,
  note,
}: {
  slot: Slot;
  count: number;
  capacity: number;
  hint: RendererProps<BeadState>["hint"];
  interactive: boolean;
  ms: number;
  m: Material;
  onCount: (n: number) => void;
  bead: typeof TenBead;
  /** Indices currently animating away during an exchange. */
  leaving?: Set<number>;
  note: string;
}) {
  const { trackRef, dragging, onPointerDown } = useRodDrag(capacity, interactive, onCount);
  const hinted = hint?.slot === slot;

  return (
    <section
      aria-label={`${SLOT_LABEL[slot]} rod, ${count} of ${capacity}`}
      className="rounded-3xl border-2 p-4 sm:p-5"
      style={{
        borderColor: hinted ? m.fill : "var(--line)",
        background: hinted ? m.wash : "var(--surface)",
        transition: ms ? `background-color ${ms}ms, border-color ${ms}ms` : "none",
      }}
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h3 className="text-2xl font-semibold tracking-tight" style={{ color: m.edge }}>
            {SLOT_LABEL[slot]}
          </h3>
          <span className="text-sm text-[var(--ink-soft)]">{note}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!interactive || count === 0}
            onClick={() => onCount(count - 1)}
            aria-label={`Take one away from ${SLOT_LABEL[slot]}`}
            className="flex h-11 w-11 items-center justify-center rounded-full border-2 text-2xl leading-none disabled:opacity-30"
            style={{ borderColor: m.slot, color: m.edge }}
          >
            −
          </button>
          <output
            aria-label={`${SLOT_LABEL[slot]} count`}
            className="min-w-16 rounded-2xl px-3 py-1.5 text-center text-3xl font-semibold tabular-nums"
            style={{ background: m.wash, color: m.edge }}
          >
            {count}
          </output>
          <button
            type="button"
            disabled={!interactive || count >= capacity}
            onClick={() => onCount(count + 1)}
            aria-label={`Add one to ${SLOT_LABEL[slot]}`}
            className="flex h-11 w-11 items-center justify-center rounded-full border-2 text-2xl leading-none disabled:opacity-30"
            style={{ borderColor: m.slot, color: m.edge }}
          >
            +
          </button>
        </div>
      </header>

      {/* The wire. Dragging anywhere along it moves the beads. */}
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        role="slider"
        tabIndex={interactive ? 0 : -1}
        aria-label={`${SLOT_LABEL[slot]}: drag to change`}
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuenow={count}
        onKeyDown={(e) => {
          if (!interactive) return;
          if (e.key === "ArrowRight" || e.key === "ArrowUp") onCount(count + 1);
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") onCount(count - 1);
          if (e.key === "Home") onCount(0);
          if (e.key === "End") onCount(capacity);
        }}
        className="relative select-none rounded-2xl px-3 py-3"
        style={{
          background: "var(--bg)",
          cursor: interactive ? (dragging ? "grabbing" : "grab") : "default",
          touchAction: "none",
          boxShadow: dragging ? `inset 0 0 0 2px ${m.fill}` : "none",
        }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-4 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
          style={{ background: m.slot }}
        />
        <div className="relative flex flex-nowrap items-center justify-start gap-x-3 overflow-x-auto">
          {groupsOf(capacity).map((group, gi) => (
            <div key={gi} className="flex shrink-0 items-center gap-1">
              {group.map((i) => {
                const on = i < count;
                const going = leaving?.has(i) ?? false;
                return (
                  <span
                    key={i}
                    className="leading-none"
                    style={{
                      opacity: going ? 0 : 1,
                      transform: going ? "translateY(-26px) scale(0.6)" : "none",
                      transition: ms ? `opacity ${ms * 2}ms, transform ${ms * 2}ms` : "none",
                    }}
                  >
                    <Bead
                      on={on}
                      ghost={hint?.value !== undefined && !on && i < hint.value}
                      ms={ms}
                      m={m}
                      lifted={dragging && on && i === count - 1}
                    />
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- the exchange ----------

/**
 * Ten ones become one ten — performed, not narrated. The button only
 * appears when the trade is actually available, so it never teaches the
 * child to press it out of habit.
 */
function TradeControl({
  state,
  ms,
  onTrade,
  running,
}: {
  state: BeadState;
  ms: number;
  onTrade: () => void;
  running: boolean;
}) {
  if (!canExchange(state)) return null;
  const ones = materialsFor(1).ones;
  const tens = materialsFor(1).tens;
  return (
    <button
      type="button"
      onClick={onTrade}
      disabled={running}
      className="flex items-center justify-center gap-3 rounded-2xl border-2 px-6 py-4 text-xl disabled:opacity-60"
      style={{
        borderColor: tens.fill,
        background: tens.wash,
        color: tens.edge,
        transition: ms ? `opacity ${ms}ms` : "none",
      }}
    >
      <span
        className="inline-block h-5 w-5 rounded-full"
        style={{ background: ones.fill }}
        aria-hidden="true"
      />
      <span>Trade 10 ones for 1 ten</span>
      <span
        className="inline-block h-6 w-3 rounded"
        style={{ background: tens.fill }}
        aria-hidden="true"
      />
    </button>
  );
}

function useTrade(
  state: BeadState,
  onChange: (s: BeadState) => void,
  ms: number
) {
  const [leaving, setLeaving] = useState<Set<number> | null>(null);

  const trade = useCallback(() => {
    if (!canExchange(state)) return;
    const going = new Set(Array.from({ length: 10 }, (_, i) => state.ones - 1 - i));
    if (ms === 0) {
      onChange({ tens: state.tens + 1, ones: state.ones - 10 });
      return;
    }
    setLeaving(going);
    window.setTimeout(() => {
      onChange({ tens: state.tens + 1, ones: state.ones - 10 });
      setLeaving(null);
    }, ms * 2);
  }, [state, onChange, ms]);

  return { leaving, trade, running: leaving !== null };
}

// ---------- C — concrete ----------

export function BeadFrameConcrete(props: RendererProps<BeadState>) {
  const ms = motionMs(props.motionLevel);
  const mat = materialsFor(props.motionLevel);
  const set = (slot: Slot, n: number) =>
    props.interactive && props.onChange(clampBeadState({ ...props.state, [slot]: n }));
  const { leaving, trade, running } = useTrade(props.state, props.onChange, ms);

  return (
    <div className="flex flex-col gap-4">
      <Rod
        slot="tens"
        count={props.state.tens}
        capacity={TENS_CAPACITY}
        hint={props.hint}
        interactive={props.interactive && !running}
        ms={ms}
        m={mat.tens}
        onCount={(n) => set("tens", n)}
        bead={TenBead}
        note="each one is worth 10"
      />
      <Rod
        slot="ones"
        count={props.state.ones}
        capacity={ONES_CAPACITY}
        hint={props.hint}
        interactive={props.interactive && !running}
        ms={ms}
        m={mat.ones}
        onCount={(n) => set("ones", n)}
        bead={OneBead as typeof TenBead}
        leaving={leaving ?? undefined}
        note="each one is worth 1"
      />
      {props.interactive && (
        <TradeControl state={props.state} ms={ms} onTrade={trade} running={running} />
      )}
      <TotalStrip state={props.state} />
    </div>
  );
}

// ---------- R — representational ----------

export function BeadFrameRepresentational(props: RendererProps<BeadState>) {
  const ms = motionMs(props.motionLevel);
  const mat = materialsFor(props.motionLevel);
  const set = (slot: Slot, n: number) =>
    props.interactive && props.onChange(clampBeadState({ ...props.state, [slot]: n }));
  const { leaving, trade, running } = useTrade(props.state, props.onChange, ms);

  const Stick = ({ on, ghost, m }: { on: boolean; ghost: boolean; m: Material }) => (
    <svg width="30" height="70" viewBox="0 0 30 70" aria-hidden="true">
      <line
        x1="15"
        y1="5"
        x2="15"
        y2="65"
        stroke={on ? m.fill : ghost ? m.fill : m.slot}
        strokeWidth={on ? 8 : 3}
        strokeLinecap="round"
        strokeDasharray={on ? undefined : "5 5"}
        opacity={on ? 1 : ghost ? 0.85 : 0.55}
        style={{ transition: ms ? `stroke-width ${ms}ms` : "none" }}
      />
    </svg>
  );

  const Dot = ({ on, ghost, m }: { on: boolean; ghost: boolean; m: Material }) => (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      <circle
        cx="17"
        cy="17"
        r={on ? 11 : 9}
        fill={on ? m.fill : "none"}
        stroke={on ? "none" : ghost ? m.fill : m.slot}
        strokeWidth="2.5"
        strokeDasharray={on ? undefined : "4 4"}
        opacity={on ? 1 : ghost ? 0.85 : 0.55}
        style={{ transition: ms ? `r ${ms}ms` : "none" }}
      />
    </svg>
  );

  return (
    <div className="flex flex-col gap-4">
      <Rod
        slot="tens"
        count={props.state.tens}
        capacity={TENS_CAPACITY}
        hint={props.hint}
        interactive={props.interactive && !running}
        ms={ms}
        m={mat.tens}
        onCount={(n) => set("tens", n)}
        bead={Stick as unknown as typeof TenBead}
        note="each stick is ten"
      />
      <Rod
        slot="ones"
        count={props.state.ones}
        capacity={ONES_CAPACITY}
        hint={props.hint}
        interactive={props.interactive && !running}
        ms={ms}
        m={mat.ones}
        onCount={(n) => set("ones", n)}
        bead={Dot as unknown as typeof TenBead}
        leaving={leaving ?? undefined}
        note="each dot is one"
      />
      {props.interactive && (
        <TradeControl state={props.state} ms={ms} onTrade={trade} running={running} />
      )}
      <TotalStrip state={props.state} />
    </div>
  );
}

// ---------- A — abstract ----------

export function BeadFrameAbstract(props: RendererProps<BeadState>) {
  const mat = materialsFor(props.motionLevel);
  const set = (slot: Slot, n: number) =>
    props.interactive && props.onChange(clampBeadState({ ...props.state, [slot]: n }));

  const field = (slot: Slot, capacity: number, m: Material) => (
    <span className="inline-flex flex-col items-center gap-2">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={capacity}
        value={props.state[slot]}
        disabled={!props.interactive}
        onChange={(e) => set(slot, Number(e.target.value || 0))}
        aria-label={`${SLOT_LABEL[slot]} value`}
        className="w-28 rounded-2xl border-2 px-3 py-4 text-center text-4xl font-semibold tabular-nums"
        style={{
          borderColor: props.hint?.slot === slot ? m.fill : m.slot,
          background: m.wash,
          color: m.edge,
        }}
      />
      <span className="text-base" style={{ color: m.edge }}>
        {SLOT_LABEL[slot]}
      </span>
    </span>
  );

  return (
    <div className="rounded-3xl border-2 border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-center gap-5 text-4xl text-[var(--ink)]">
        {field("tens", TENS_CAPACITY, mat.tens)}
        <span aria-hidden="true" className="pt-4">+</span>
        {field("ones", ONES_CAPACITY, mat.ones)}
        <span aria-hidden="true" className="pt-4">=</span>
        <output
          className="min-w-28 rounded-2xl px-4 py-4 text-center text-4xl font-semibold tabular-nums"
          style={{ background: "var(--accent-soft)" }}
        >
          {beadValue(props.state)}
        </output>
      </div>
      <p className="mt-5 text-center text-xl text-[var(--ink-soft)]">
        {props.state.tens} tens and {props.state.ones} ones make {beadValue(props.state)}.
      </p>
    </div>
  );
}

// ---------- the running total ----------

function TotalStrip({ state }: { state: BeadState }) {
  const m = materialsFor(1);
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl border-2 px-5 py-3 text-xl"
      style={{ borderColor: "var(--line)", background: "var(--surface)" }}
    >
      <span
        className="rounded-xl px-3 py-1 tabular-nums"
        style={{ background: m.tens.wash, color: m.tens.edge }}
      >
        {state.tens} tens
      </span>
      <span aria-hidden="true">+</span>
      <span
        className="rounded-xl px-3 py-1 tabular-nums"
        style={{ background: m.ones.wash, color: m.ones.edge }}
      >
        {state.ones} ones
      </span>
      <span aria-hidden="true">=</span>
      <strong className="text-3xl tabular-nums">{beadValue(state)}</strong>
    </div>
  );
}
