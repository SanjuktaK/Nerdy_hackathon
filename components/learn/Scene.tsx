"use client";

// ============================================================
// The living background. A slow scene behind everything — clouds drifting
// over hills, bubbles rising under the sea, stars breathing in space.
//
// Autism-specific rules it follows:
//   · It moves slowly and predictably (30–90 s loops, no sudden changes).
//   · It sits behind the panels, never behind the maths: the work area is
//     solid, so the task is always the calmest, clearest thing on screen.
//   · "Still" freezes it, "plain" removes it, and the no-movement switch or
//     the OS reduced-motion setting always wins.
// ============================================================

import type { BackgroundMode } from "@/lib/learn/types";
import type { World } from "@/lib/learn/worlds";

type Kind = "meadow" | "rail" | "sea" | "space";

const kindOf = (w: World): Kind =>
  w.body === "fish" ? "sea" : w.body === "astronaut" || w.body === "robot" ? "space" : w.body === "engine" ? "rail" : "meadow";

function Cloud({ y, scale, dur, delay }: { y: number; scale: number; dur: number; delay: number }) {
  return (
    <g className="scene-drift" style={{ animationDuration: `${dur}s`, animationDelay: `-${delay}s` }}>
      <g transform={`translate(0 ${y}) scale(${scale})`} fill="#fff" opacity="0.85">
        <ellipse cx="60" cy="30" rx="44" ry="18" />
        <ellipse cx="96" cy="22" rx="34" ry="20" />
        <ellipse cx="30" cy="26" rx="26" ry="14" />
      </g>
    </g>
  );
}

function Meadow({ w, rail }: { w: World; rail?: boolean }) {
  const c = w.colours;
  return (
    <>
      <Cloud y={70} scale={1.1} dur={95} delay={10} />
      <Cloud y={150} scale={0.8} dur={120} delay={60} />
      <Cloud y={40} scale={0.6} dur={140} delay={100} />
      <path d="M0 640 Q 250 540 520 610 T 1040 590 T 1600 620 V 900 H 0 Z" fill={c.ground} opacity="0.55" />
      <path d="M0 700 Q 300 620 640 690 T 1300 670 T 1600 700 V 900 H 0 Z" fill={c.ground} opacity="0.9" />
      {rail && (
        <>
          <rect x="0" y="686" width="1600" height="6" fill="#8a7a66" opacity="0.5" />
          <g className="scene-drift" style={{ animationDuration: "70s" }}>
            <g transform="translate(0 650)" opacity="0.8">
              <rect x="0" y="0" width="46" height="30" rx="6" fill={c.body} />
              <rect x="10" y="-14" width="10" height="16" fill="#4b4f5c" />
              {[1, 2, 3].map((i) => (
                <rect key={i} x={i * 52} y="4" width="44" height="26" rx="5" fill={c.tens} />
              ))}
            </g>
          </g>
        </>
      )}
      {!rail &&
        [180, 420, 760, 1100, 1380].map((x, i) => (
          <g key={x} className="scene-sway" style={{ animationDelay: `-${i * 1.3}s`, transformOrigin: `${x}px 720px` }}>
            <line x1={x} y1="720" x2={x} y2="690" stroke="#5a8a4a" strokeWidth="3" />
            <circle cx={x} cy="686" r="7" fill={i % 2 ? c.accent : "#f4c542"} opacity="0.9" />
          </g>
        ))}
      {!rail && (
        <g className="scene-float">
          <g transform="translate(300 260)">
            <ellipse cx="0" cy="0" rx="7" ry="5" fill="#f4c542" />
            <path d="M-3 -4 v8 M1 -5 v10" stroke="#3a2a1a" strokeWidth="1.5" />
            <ellipse cx="-2" cy="-7" rx="5" ry="3.5" fill="#fff" opacity="0.8" />
          </g>
        </g>
      )}
    </>
  );
}

function Sea({ w }: { w: World }) {
  const c = w.colours;
  return (
    <>
      {[200, 520, 900, 1250].map((x, i) => (
        <polygon key={x} points={`${x},0 ${x + 60},0 ${x + 260},900 ${x + 120},900`} fill="#fff" opacity="0.08" className="scene-breathe" style={{ animationDelay: `-${i * 2}s` }} />
      ))}
      {Array.from({ length: 14 }).map((_, i) => (
        <circle
          key={i}
          cx={60 + ((i * 113) % 1500)}
          cy="920"
          r={4 + (i % 4) * 3}
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          opacity="0.6"
          className="scene-rise"
          style={{ animationDuration: `${16 + (i % 5) * 4}s`, animationDelay: `-${(i * 3.1) % 20}s` }}
        />
      ))}
      <path d="M0 780 Q 400 740 800 780 T 1600 770 V 900 H 0 Z" fill={c.ground} opacity="0.9" />
      {[120, 340, 1180, 1420].map((x, i) => (
        <path
          key={x}
          d={`M${x} 800 q -18 -40 0 -80 q 18 -40 0 -80`}
          stroke="#3f8f6a"
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          opacity="0.6"
          className="scene-sway"
          style={{ transformOrigin: `${x}px 800px`, animationDelay: `-${i}s` }}
        />
      ))}
    </>
  );
}

function Space({ w }: { w: World }) {
  const c = w.colours;
  return (
    <>
      {Array.from({ length: 40 }).map((_, i) => (
        <circle
          key={i}
          cx={(i * 197) % 1600}
          cy={(i * 131) % 700}
          r={1.2 + (i % 3)}
          fill="#fff"
          className="scene-twinkle"
          style={{ animationDelay: `-${(i * 0.7) % 6}s` }}
        />
      ))}
      <g className="scene-float" style={{ animationDuration: "40s" }}>
        <circle cx="1300" cy="180" r="60" fill={c.hundreds} opacity="0.55" />
        <ellipse cx="1300" cy="180" rx="95" ry="16" fill="none" stroke={c.tens} strokeWidth="5" opacity="0.5" />
      </g>
      <circle cx="220" cy="760" r="240" fill={c.ground} opacity="0.5" />
    </>
  );
}

export function Scene({ world, mode }: { world: World; mode: BackgroundMode }) {
  if (mode === "plain") return null;
  const kind = kindOf(world);
  const sky =
    kind === "sea"
      ? `linear-gradient(${world.colours.sky}, color-mix(in srgb, ${world.colours.bead} 45%, ${world.colours.sky}))`
      : kind === "space"
        ? `linear-gradient(color-mix(in srgb, ${world.colours.accent} 35%, #2d2f4a), color-mix(in srgb, ${world.colours.sky} 55%, #6a6aa0))`
        : `linear-gradient(${world.colours.sky}, color-mix(in srgb, ${world.colours.sky} 70%, white))`;
  return (
    <div className={`scene ${mode === "still" ? "scene-still" : ""}`} style={{ background: sky }} aria-hidden="true">
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" className="h-full w-full">
        {kind === "sea" ? <Sea w={world} /> : kind === "space" ? <Space w={world} /> : <Meadow w={world} rail={kind === "rail"} />}
      </svg>
    </div>
  );
}
