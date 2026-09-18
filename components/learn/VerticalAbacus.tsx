"use client";

// ============================================================
// The bead frame, standing up.
//
// Each place is an upright rod holding up to nine beads. Beads stack from
// the bottom, grouped in fives so "seven" is seen rather than counted.
// Drag up a rod to add beads, drag down to take them away — the hand does
// the arithmetic before the head does. Each rod is also a real slider, so
// arrow keys and switch access work, and there are +/− buttons for hands
// that find dragging hard.
//
// The bead is the world's: honey drops for Pooh, stars in space, eggs for
// the dinosaurs. Hundreds, tens and ones are three different colours,
// because colour is carrying the place value.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";

import { sfxBead } from "@/lib/learn/sound";
import type { BeadShape, World } from "@/lib/learn/worlds";

export type Place = "hundreds" | "tens" | "ones";
const MULT: Record<Place, number> = { hundreds: 100, tens: 10, ones: 1 };
const LABEL: Record<Place, string> = { hundreds: "Hundreds", tens: "Tens", ones: "Ones" };
const CAP = 9;
const BEAD_H = 30;
const GAP = 3;
const GROUP_GAP = 10;

export const digitsOf = (value: number, cols: Place[]) =>
  Object.fromEntries(cols.map((p) => [p, Math.floor(value / MULT[p]) % 10])) as Record<Place, number>;

export const valueOf = (d: Partial<Record<Place, number>>) =>
  (d.hundreds ?? 0) * 100 + (d.tens ?? 0) * 10 + (d.ones ?? 0);

function Bead({ shape, fill, edge, on }: { shape: BeadShape; fill: string; edge: string; on: boolean }) {
  const f = on ? fill : "transparent";
  const s = on ? edge : "var(--line)";
  const dash = on ? undefined : "3 3";
  const w = 58;
  let body: React.ReactNode;
  switch (shape) {
    case "drop":
      body = <path d="M29 2 q18 12 18 18 a18 8 0 0 1 -36 0 q0 -6 18 -18 z" transform="translate(0 0)" />;
      break;
    case "egg":
      body = <ellipse cx="29" cy="15" rx="18" ry="13" />;
      break;
    case "star":
      body = <path d="M29 1 l4.5 8.5 9.5 1.2 -7 6.3 1.8 9.3 -8.8 -4.5 -8.8 4.5 1.8 -9.3 -7 -6.3 9.5 -1.2 z" transform="translate(-10 0) scale(1.35 1.05)" />;
      break;
    case "bubble":
      body = <ellipse cx="29" cy="15" rx="24" ry="13" />;
      break;
    default:
      body = <rect x="4" y="2" width="50" height="26" rx="13" />;
  }
  return (
    <svg width={w} height={BEAD_H} viewBox={`0 0 ${w} ${BEAD_H}`} aria-hidden="true" className="block overflow-visible">
      <g fill={f} stroke={s} strokeWidth={on ? 1.8 : 1.5} strokeDasharray={dash} opacity={on ? 1 : 0.55}>
        {body}
      </g>
      {on && <ellipse cx="21" cy="10" rx="6" ry="3" fill="#fff" opacity="0.45" />}
    </svg>
  );
}

function Rod({
  place,
  count,
  world,
  interactive,
  highlight,
  onChange,
}: {
  place: Place;
  count: number;
  world: World;
  interactive: boolean;
  highlight: boolean;
  onChange: (n: number) => void;
}) {
  const w = world;
  const colour =
    place === "ones"
      ? { fill: w.colours.bead, edge: w.colours.beadEdge }
      : place === "tens"
        ? { fill: w.colours.tens, edge: w.colours.tensEdge }
        : { fill: w.colours.hundreds, edge: w.colours.hundredsEdge };

  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const countFromY = useCallback((clientY: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const fromBottom = r.bottom - clientY;
    return Math.max(0, Math.min(CAP, Math.round(fromBottom / (r.height / CAP))));
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      e.preventDefault();
      onChange(countFromY(e.clientY));
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
  }, [dragging, countFromY, onChange]);

  const onKey = (e: React.KeyboardEvent) => {
    if (!interactive) return;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") onChange(Math.min(CAP, count + 1));
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") onChange(Math.max(0, count - 1));
    else if (e.key === "Home") onChange(0);
    else if (e.key === "End") onChange(CAP);
    else return;
    e.preventDefault();
  };

  // Slots from the top (9) down to the bottom (1); a bead is "on" if its slot ≤ count.
  const slots = Array.from({ length: CAP }, (_, i) => CAP - i);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`rounded-2xl px-2 pt-2 pb-1 transition-colors ${highlight ? "bg-[var(--glow)]" : ""}`}
      >
        <div
          ref={trackRef}
          role="slider"
          tabIndex={interactive ? 0 : -1}
          aria-label={`${LABEL[place]} rod`}
          aria-valuemin={0}
          aria-valuemax={CAP}
          aria-valuenow={count}
          aria-valuetext={`${count} ${LABEL[place].toLowerCase()}`}
          aria-disabled={!interactive}
          onKeyDown={onKey}
          onPointerDown={(e) => {
            if (!interactive) return;
            e.preventDefault();
            setDragging(true);
            onChange(countFromY(e.clientY));
          }}
          className={`relative flex touch-none select-none flex-col items-center ${interactive ? "cursor-grab active:cursor-grabbing" : ""}`}
          style={{ height: CAP * (BEAD_H + GAP) + GROUP_GAP }}
        >
          {/* the rod */}
          <div className="absolute inset-y-0 left-1/2 w-[7px] -translate-x-1/2 rounded-full bg-[var(--rod)]" />
          {slots.map((slot) => (
            <div
              key={slot}
              className="relative"
              style={{
                marginTop: slot === 5 ? GROUP_GAP : 0,
                marginBottom: GAP,
                transform: slot <= count ? "translateY(0)" : "translateY(-2px)",
                transition: "transform 180ms ease",
              }}
            >
              <Bead shape={w.bead} fill={colour.fill} edge={colour.edge} on={slot <= count} />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!interactive || count === 0}
          onClick={() => onChange(count - 1)}
          aria-label={`One fewer in ${LABEL[place].toLowerCase()}`}
          className="step-btn"
        >
          −
        </button>
        <span className="w-9 text-center font-display text-3xl font-bold tabular-nums" aria-hidden="true">
          {count}
        </span>
        <button
          type="button"
          disabled={!interactive || count === CAP}
          onClick={() => onChange(count + 1)}
          aria-label={`One more in ${LABEL[place].toLowerCase()}`}
          className="step-btn"
        >
          +
        </button>
      </div>
      <span
        className="rounded-full px-3 py-0.5 text-sm font-bold"
        style={{ background: colour.fill, color: "#2a2016" }}
      >
        {LABEL[place]}
      </span>
    </div>
  );
}

export function VerticalAbacus({
  columns,
  value,
  world,
  onChange,
  interactive = true,
  highlight,
  showTotal = true,
}: {
  columns: Place[];
  value: number;
  world: World;
  onChange?: (v: number) => void;
  interactive?: boolean;
  highlight?: Place | null;
  showTotal?: boolean;
}) {
  const d = digitsOf(value, columns);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="abacus-frame flex items-end gap-3 sm:gap-6">
        {columns.map((p) => (
          <Rod
            key={p}
            place={p}
            count={d[p]}
            world={world}
            interactive={interactive}
            highlight={highlight === p}
            onChange={(n) => {
              if (n !== d[p]) sfxBead(p, n > d[p]);
              onChange?.(valueOf({ ...d, [p]: n }));
            }}
          />
        ))}
      </div>
      {showTotal && (
        <p className="text-lg text-[var(--ink-soft)]" aria-live="polite">
          You built <span className="font-display text-3xl font-bold text-[var(--ink)] tabular-nums">{value}</span>
        </p>
      )}
    </div>
  );
}
