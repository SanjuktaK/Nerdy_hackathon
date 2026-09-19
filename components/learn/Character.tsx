"use client";

// ============================================================
// The companion. Generated once at onboarding (name, accent colour,
// accessory, catchphrase) and drawn here as SVG, so it looks the same on
// every screen and every visit.
//
// Tapping the character is always allowed outside the demo: a small wave,
// a line spoken aloud, and in the honey world Pooh has a taste from his pot.
// ============================================================

import { useEffect, useRef, useState } from "react";

import type { BodyId, Character as CharacterSpec } from "@/lib/learn/types";
import { worldOf } from "@/lib/learn/worlds";

export type Mood = "calm" | "happy" | "cheer" | "thinking" | "eating" | "sleepy" | "talking";

function Face({ mood, x = 50, y = 50, ink = "#3a2a1a" }: { mood: Mood; x?: number; y?: number; ink?: string }) {
  const closed = mood === "sleepy" || mood === "eating";
  const eye = (cx: number) =>
    closed ? (
      <path d={`M${cx - 3.5} ${y} q3.5 3 7 0`} stroke={ink} strokeWidth="2.2" fill="none" strokeLinecap="round" />
    ) : (
      <g>
        <circle cx={cx} cy={y} r={mood === "cheer" ? 3.6 : 3.2} fill={ink} />
        <circle cx={cx + 1.1} cy={y - 1.2} r="1" fill="#fff" />
      </g>
    );
  const mouth: Record<Mood, string> = {
    calm: `M${x - 6} ${y + 11} q6 4 12 0`,
    happy: `M${x - 7} ${y + 10} q7 7 14 0`,
    cheer: `M${x - 8} ${y + 9} q8 11 16 0 z`,
    thinking: `M${x - 4} ${y + 12} q4 -2 8 0`,
    eating: `M${x - 4} ${y + 10} q4 5 8 0 z`,
    sleepy: `M${x - 4} ${y + 12} q4 2 8 0`,
    talking: "",
  };
  return (
    <g>
      {eye(x - 9)}
      {eye(x + 9)}
      {mood === "talking" ? (
        // An open mouth that moves while the voice plays.
        <ellipse cx={x} cy={y + 12} rx="5.5" ry="4.5" fill="#7a3b2a" stroke={ink} strokeWidth="1.8" className="talk-mouth" />
      ) : (
      <path
        d={mouth[mood]}
        stroke={ink}
        strokeWidth="2.4"
        fill={mood === "cheer" || mood === "eating" ? "#7a3b2a" : "none"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      )}
      {(mood === "happy" || mood === "cheer" || mood === "talking") && (
        <>
          <ellipse cx={x - 16} cy={y + 7} rx="4" ry="2.4" fill="#f08a8a" opacity="0.45" />
          <ellipse cx={x + 16} cy={y + 7} rx="4" ry="2.4" fill="#f08a8a" opacity="0.45" />
        </>
      )}
    </g>
  );
}

function Accessory({ c, neckY, headTop, cx = 50 }: { c: CharacterSpec; neckY: number; headTop: number; cx?: number }) {
  switch (c.accessory) {
    case "scarf":
      return (
        <g>
          <rect x={cx - 22} y={neckY - 4} width="44" height="9" rx="4.5" fill={c.accent} />
          <rect x={cx + 8} y={neckY + 2} width="8" height="16" rx="3" fill={c.accent} transform={`rotate(12 ${cx + 12} ${neckY + 4})`} />
        </g>
      );
    case "hat":
      return (
        <g>
          <rect x={cx - 20} y={headTop - 4} width="40" height="6" rx="3" fill={c.accent} />
          <rect x={cx - 12} y={headTop - 20} width="24" height="18" rx="4" fill={c.accent} />
        </g>
      );
    case "cap":
      return <path d={`M${cx - 18} ${headTop + 6} q18 -22 36 0 h10 q-4 5 -10 5 h-36 z`} fill={c.accent} />;
    case "bow":
      return (
        <g transform={`translate(${cx + 14} ${headTop + 4})`}>
          <path d="M0 0 l-10 -7 v14 z M0 0 l10 -7 v14 z" fill={c.accent} />
          <circle r="3" fill={c.accent} />
        </g>
      );
    default:
      return null;
  }
}

function Bear({ c, mood }: { c: CharacterSpec; mood: Mood }) {
  const dark = "#b27a2a";
  return (
    <g>
      {/* body */}
      <ellipse cx="50" cy="92" rx="30" ry="26" fill={c.body} />
      <ellipse cx="50" cy="96" rx="18" ry="16" fill="#f3d38a" />
      {/* arms, one holding the pot */}
      <ellipse cx="22" cy="86" rx="8" ry="12" fill={c.body} transform="rotate(20 22 86)" />
      <g transform="translate(62 78)">
        <path d="M4 6 h22 l-3 22 h-16 z" fill="#c98a3d" stroke="#8a5a1f" strokeWidth="1.5" />
        <rect x="2" y="2" width="26" height="6" rx="3" fill="#a86d2b" />
        <path d="M8 6 q4 8 8 0 q4 7 8 0" fill="#f4b942" />
        <text x="15" y="23" textAnchor="middle" fontSize="6" fontWeight="800" fill="#5a3a10" fontFamily="var(--font-display)">HUNNY</text>
      </g>
      <ellipse cx="72" cy="88" rx="7" ry="10" fill={c.body} transform="rotate(-25 72 88)" />
      {/* head */}
      <circle cx="30" cy="22" r="10" fill={c.body} />
      <circle cx="70" cy="22" r="10" fill={c.body} />
      <circle cx="30" cy="22" r="5" fill={dark} opacity="0.35" />
      <circle cx="70" cy="22" r="5" fill={dark} opacity="0.35" />
      <circle cx="50" cy="44" r="27" fill={c.body} />
      <ellipse cx="50" cy="56" rx="13" ry="10" fill="#f3d38a" />
      <ellipse cx="50" cy="51" rx="5" ry="3.6" fill="#3a2a1a" />
      <Face mood={mood} y={40} />
      <Accessory c={c} neckY={69} headTop={18} />
      {mood === "eating" && <circle cx="58" cy="60" r="3" fill="#f4b942" />}
    </g>
  );
}

function Engine({ c, mood }: { c: CharacterSpec; mood: Mood }) {
  return (
    <g>
      <rect x="14" y="40" width="72" height="62" rx="12" fill={c.body} />
      <rect x="36" y="16" width="14" height="24" rx="3" fill="#4b4f5c" />
      <circle cx="43" cy="12" r="6" fill="#dfe3ea" opacity="0.8" />
      <circle cx="54" cy="6" r="4" fill="#dfe3ea" opacity="0.6" />
      <circle cx="50" cy="68" r="24" fill="#e8ecf2" stroke="#4b4f5c" strokeWidth="3" />
      <Face mood={mood} y={64} ink="#2c2f38" />
      <circle cx="28" cy="106" r="9" fill="#2c2f38" />
      <circle cx="72" cy="106" r="9" fill="#2c2f38" />
      <rect x="10" y="98" width="80" height="6" rx="3" fill={c.accent} />
      <Accessory c={c} neckY={96} headTop={40} />
    </g>
  );
}

function Dino({ c, mood }: { c: CharacterSpec; mood: Mood }) {
  return (
    <g>
      <path d="M78 96 q22 -2 18 -22 q-6 14 -20 12 z" fill={c.body} />
      <ellipse cx="50" cy="92" rx="30" ry="24" fill={c.body} />
      <ellipse cx="50" cy="98" rx="16" ry="14" fill="#e8f0c8" />
      {[26, 38, 50, 62].map((x, i) => (
        <path key={x} d={`M${x} ${20 + (i % 2) * 2} l6 -10 l6 10 z`} fill={c.accent} />
      ))}
      <ellipse cx="50" cy="46" rx="30" ry="26" fill={c.body} />
      <Face mood={mood} y={42} ink="#1f3320" />
      <circle cx="40" cy="58" r="1.4" fill="#1f3320" />
      <circle cx="60" cy="58" r="1.4" fill="#1f3320" />
      <rect x="28" y="110" width="12" height="8" rx="4" fill={c.body} />
      <rect x="60" y="110" width="12" height="8" rx="4" fill={c.body} />
      <Accessory c={c} neckY={72} headTop={20} />
    </g>
  );
}

function Astronaut({ c, mood }: { c: CharacterSpec; mood: Mood }) {
  return (
    <g>
      <rect x="26" y="70" width="48" height="42" rx="16" fill={c.body} stroke="#b9bfd3" strokeWidth="2" />
      <rect x="40" y="82" width="20" height="12" rx="3" fill={c.accent} />
      <circle cx="50" cy="44" r="30" fill={c.body} stroke="#b9bfd3" strokeWidth="2" />
      <circle cx="50" cy="46" r="22" fill="#2d2f4a" />
      <circle cx="50" cy="48" r="17" fill="#f1c9a5" />
      <Face mood={mood} y={45} ink="#2d2f4a" />
      <path d="M36 32 q6 -6 12 -4" stroke="#fff" strokeWidth="3" opacity="0.5" fill="none" strokeLinecap="round" />
      <rect x="47" y="8" width="6" height="8" rx="2" fill="#b9bfd3" />
      <circle cx="50" cy="7" r="4" fill={c.accent} />
      <Accessory c={c} neckY={72} headTop={14} />
    </g>
  );
}

function Fish({ c, mood }: { c: CharacterSpec; mood: Mood }) {
  return (
    <g>
      <path d="M78 64 l20 -18 v36 z" fill={c.body} />
      <path d="M40 30 q10 -16 24 -2" fill={c.accent} />
      <ellipse cx="48" cy="64" rx="36" ry="30" fill={c.body} />
      <path d="M36 38 q-6 26 0 52" stroke="#fff" strokeWidth="6" opacity="0.6" fill="none" />
      <path d="M58 36 q-6 28 0 56" stroke="#fff" strokeWidth="6" opacity="0.6" fill="none" />
      <Face mood={mood} x={32} y={58} ink="#3a2010" />
      <circle cx="90" cy="30" r="4" fill="none" stroke="#7fd0e8" strokeWidth="2" />
      <circle cx="96" cy="18" r="2.5" fill="none" stroke="#7fd0e8" strokeWidth="2" />
      <Accessory c={c} neckY={82} headTop={34} cx={40} />
    </g>
  );
}

function Kid({ c, mood }: { c: CharacterSpec; mood: Mood }) {
  return (
    <g>
      <rect x="30" y="98" width="14" height="16" rx="5" fill="#f1c9a5" />
      <rect x="56" y="98" width="14" height="16" rx="5" fill="#f1c9a5" />
      <rect x="28" y="88" width="44" height="16" rx="6" fill={c.accent} />
      <rect x="26" y="64" width="48" height="32" rx="14" fill={c.body} />
      <ellipse cx="22" cy="80" rx="6" ry="11" fill={c.body} transform="rotate(15 22 80)" />
      <ellipse cx="78" cy="80" rx="6" ry="11" fill={c.body} transform="rotate(-15 78 80)" />
      <ellipse cx="50" cy="42" rx="28" ry="26" fill="#f6d2b0" />
      <path d="M22 38 q2 -24 28 -24 q26 0 28 24 q-10 -10 -28 -10 q-18 0 -28 10 z" fill="#3a2a1a" />
      <ellipse cx="24" cy="46" rx="4" ry="6" fill="#f6d2b0" />
      <ellipse cx="76" cy="46" rx="4" ry="6" fill="#f6d2b0" />
      <Face mood={mood} y={44} />
      <Accessory c={c} neckY={66} headTop={16} />
    </g>
  );
}

function Puppy({ c, mood }: { c: CharacterSpec; mood: Mood }) {
  return (
    <g>
      <path d="M80 92 q16 -6 12 -20" stroke={c.body} strokeWidth="7" fill="none" strokeLinecap="round" />
      <ellipse cx="50" cy="94" rx="30" ry="22" fill={c.body} />
      <ellipse cx="50" cy="98" rx="16" ry="13" fill="#fff" opacity="0.6" />
      <ellipse cx="22" cy="40" rx="9" ry="18" fill={c.accent} transform="rotate(18 22 40)" />
      <ellipse cx="78" cy="40" rx="9" ry="18" fill={c.accent} transform="rotate(-18 78 40)" />
      <circle cx="50" cy="44" r="26" fill={c.body} />
      <ellipse cx="50" cy="56" rx="12" ry="9" fill="#fff" opacity="0.7" />
      <ellipse cx="50" cy="51" rx="5" ry="3.6" fill="#2a1a10" />
      <Face mood={mood} y={40} />
      <Accessory c={c} neckY={70} headTop={18} />
    </g>
  );
}

function Cat({ c, mood }: { c: CharacterSpec; mood: Mood }) {
  return (
    <g>
      <path d="M78 104 q20 -4 14 -30" stroke={c.body} strokeWidth="7" fill="none" strokeLinecap="round" />
      <ellipse cx="50" cy="94" rx="28" ry="22" fill={c.body} />
      <path d="M26 30 l4 -20 l14 12 z M74 30 l-4 -20 l-14 12 z" fill={c.body} />
      <path d="M30 26 l2 -10 l7 7 z M70 26 l-2 -10 l-7 7 z" fill={c.accent} opacity="0.6" />
      <circle cx="50" cy="44" r="26" fill={c.body} />
      <path d="M47 52 h6 l-3 3 z" fill="#e58a9a" />
      <path d="M30 54 h-12 M30 58 h-11 M70 54 h12 M70 58 h11" stroke="#3a2a1a" strokeWidth="1.2" />
      <Face mood={mood} y={42} />
      <Accessory c={c} neckY={70} headTop={20} />
    </g>
  );
}

function Bunny({ c, mood }: { c: CharacterSpec; mood: Mood }) {
  return (
    <g>
      <ellipse cx="50" cy="94" rx="28" ry="22" fill={c.body} />
      <ellipse cx="50" cy="98" rx="15" ry="13" fill="#fff" opacity="0.6" />
      <ellipse cx="38" cy="16" rx="7" ry="20" fill={c.body} />
      <ellipse cx="62" cy="16" rx="7" ry="20" fill={c.body} />
      <ellipse cx="38" cy="16" rx="3.5" ry="14" fill={c.accent} opacity="0.5" />
      <ellipse cx="62" cy="16" rx="3.5" ry="14" fill={c.accent} opacity="0.5" />
      <circle cx="50" cy="48" r="25" fill={c.body} />
      <ellipse cx="50" cy="56" rx="3" ry="2.2" fill="#e58a9a" />
      <Face mood={mood} y={46} />
      <Accessory c={c} neckY={72} headTop={26} />
    </g>
  );
}

function Robot({ c, mood }: { c: CharacterSpec; mood: Mood }) {
  return (
    <g>
      <rect x="28" y="72" width="44" height="38" rx="8" fill={c.body} stroke="#5c6470" strokeWidth="2" />
      <circle cx="50" cy="90" r="7" fill={c.accent} />
      <rect x="16" y="78" width="10" height="24" rx="5" fill={c.body} stroke="#5c6470" strokeWidth="2" />
      <rect x="74" y="78" width="10" height="24" rx="5" fill={c.body} stroke="#5c6470" strokeWidth="2" />
      <rect x="22" y="22" width="56" height="46" rx="12" fill={c.body} stroke="#5c6470" strokeWidth="2" />
      <rect x="29" y="30" width="42" height="30" rx="8" fill="#e8f1f4" />
      <line x1="50" y1="22" x2="50" y2="10" stroke="#5c6470" strokeWidth="3" />
      <circle cx="50" cy="8" r="4" fill={c.accent} />
      <Face mood={mood} y={42} ink="#24303a" />
      <Accessory c={c} neckY={72} headTop={22} />
    </g>
  );
}

function Pig({ c, mood }: { c: CharacterSpec; mood: Mood }) {
  return (
    <g>
      <path d="M80 96 q12 -2 8 -10 q-4 -6 -8 0" stroke={c.body} strokeWidth="3" fill="none" />
      <ellipse cx="50" cy="94" rx="30" ry="22" fill={c.body} />
      <rect x="30" y="80" width="40" height="26" rx="10" fill={c.accent} />
      <path d="M28 26 l-4 -14 l14 8 z M72 26 l4 -14 l-14 8 z" fill={c.body} />
      <circle cx="50" cy="44" r="26" fill={c.body} />
      <ellipse cx="50" cy="54" rx="11" ry="8" fill={shadeFill(c.body)} />
      <ellipse cx="46" cy="54" rx="2" ry="3" fill="#7a3b3b" />
      <ellipse cx="54" cy="54" rx="2" ry="3" fill="#7a3b3b" />
      <Face mood={mood} y={38} />
      <Accessory c={c} neckY={70} headTop={18} />
    </g>
  );
}

const shadeFill = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(v * 0.85).toString(16).padStart(2, "0");
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
};

const BODIES: Record<BodyId, (p: { c: CharacterSpec; mood: Mood }) => React.ReactElement> = {
  bear: Bear,
  engine: Engine,
  dino: Dino,
  astronaut: Astronaut,
  fish: Fish,
  kid: Kid,
  puppy: Puppy,
  cat: Cat,
  bunny: Bunny,
  robot: Robot,
  pig: Pig,
};

export function CharacterArt({
  character,
  mood = "calm",
  size = 180,
  className = "",
}: {
  character: CharacterSpec;
  mood?: Mood;
  size?: number;
  className?: string;
}) {
  const Body = BODIES[worldOf(character).body] ?? Bear;
  return (
    <svg
      viewBox="0 0 110 122"
      width={size}
      height={(size * 122) / 110}
      role="img"
      aria-label={`${character.name}, ${mood === "calm" ? "smiling" : mood}`}
      className={className}
    >
      <ellipse cx="52" cy="118" rx="36" ry="4" fill="#000" opacity="0.08" />
      <Body c={character} mood={mood} />
    </svg>
  );
}

const TAP_LINES: Record<BodyId, string[]> = {
  bear: ["Mmm, honey.", "Hello, friend.", "One small taste.", "Hum dum."],
  engine: ["Choo choo.", "All aboard.", "Next stop, numbers."],
  dino: ["Stomp, stomp.", "Hello, friend.", "Rawr, gently."],
  astronaut: ["Hello from space.", "Five, four, three, two, one.", "The stars are out."],
  fish: ["Blub, blub.", "Hello, friend.", "Splash."],
  kid: ["Hello, friend.", "Let us count.", "That tickles."],
  puppy: ["Woof.", "Hello, friend.", "Wag, wag."],
  cat: ["Meow.", "Hello, friend.", "Purr."],
  bunny: ["Hop, hop.", "Hello, friend.", "Twitch, twitch."],
  robot: ["Beep boop.", "Hello, friend.", "Counting mode on."],
  pig: ["Oink.", "Hello, friend.", "Splash in the puddle."],
};

/**
 * The tappable companion. A tap never changes anything in the maths; it is
 * there so the character is something to play with, not just look at.
 */
export function Buddy({
  character,
  mood = "calm",
  size = 180,
  interactive = true,
  onSay,
}: {
  character: CharacterSpec;
  mood?: Mood;
  size?: number;
  interactive?: boolean;
  onSay?: (line: string) => void;
}) {
  const [react, setReact] = useState<Mood | null>(null);
  const [speaking, setSpeaking] = useState(false);
  // The voice announces when it starts and stops; the mouth follows it.
  useEffect(() => {
    const on = (e: Event) => setSpeaking(!!(e as CustomEvent<boolean>).detail);
    window.addEventListener("tally:speaking", on);
    return () => window.removeEventListener("tally:speaking", on);
  }, []);
  const [bump, setBump] = useState(0);
  const tapCount = useRef(0);
  useEffect(() => {
    if (!react) return;
    const t = setTimeout(() => setReact(null), 1400);
    return () => clearTimeout(t);
  }, [react, bump]);

  const tap = () => {
    if (!interactive) return;
    const body = worldOf(character).body;
    const lines = character.skin?.id === "custom" && character.catchphrase ? [character.catchphrase, ...TAP_LINES[body]] : TAP_LINES[body];
    const line = lines[tapCount.current++ % lines.length];
    setReact(body === "bear" && tapCount.current % 2 === 1 ? "eating" : "happy");
    setBump((b) => b + 1);
    onSay?.(line);
  };

  return (
    <button
      type="button"
      onClick={tap}
      disabled={!interactive}
      aria-label={interactive ? `Tap ${character.name}` : character.name}
      className="buddy relative rounded-full disabled:cursor-default"
    >
      <span key={bump} className={react ? "inline-block animate-wiggle" : "inline-block animate-breathe"}>
        <CharacterArt character={character} mood={react ?? (speaking && mood !== "sleepy" ? "talking" : mood)} size={size} />
      </span>
    </button>
  );
}
