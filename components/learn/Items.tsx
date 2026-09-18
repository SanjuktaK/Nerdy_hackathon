"use client";

import type { World } from "@/lib/learn/worlds";

/** One countable thing in the child's world: a honey pot, a carriage, a snack... */
export function ItemIcon({ world, size = 36, state = "on" }: { world: World; size?: number; state?: "on" | "gone" | "lit" }) {
  const c = world.colours;
  const gone = state === "gone";
  const common = { width: size, height: size, viewBox: "0 0 40 40", "aria-hidden": true as const };
  const style = {
    opacity: gone ? 0.25 : 1,
    filter: state === "lit" ? "drop-shadow(0 0 6px rgba(255,190,60,.9))" : undefined,
    transform: state === "lit" ? "scale(1.12)" : undefined,
    transition: "all 260ms ease",
  };
  const cross = gone && <path d="M8 8 L32 32 M32 8 L8 32" stroke="var(--ink-soft)" strokeWidth="3" strokeLinecap="round" />;
  const f = c.bead;
  const e = c.beadEdge;

  let art: React.ReactNode;
  switch (world.icon) {
    case "honeypot":
      art = (
        <>
          <path d="M9 13 h22 l-2 21 q-9 4 -18 0 z" fill="#c98a3d" stroke="#8a5a1f" strokeWidth="1.5" />
          <rect x="7" y="8" width="26" height="7" rx="3.5" fill="#a86d2b" />
          <path d="M11 15 q3 6 6 0 q3 5 6 0 q3 6 6 0" fill="#f4b942" />
        </>
      );
      break;
    case "carriage":
      art = (
        <>
          <rect x="5" y="10" width="30" height="20" rx="4" fill={f} stroke={e} strokeWidth="1.5" />
          <rect x="9" y="14" width="8" height="7" rx="1.5" fill="#fff" opacity="0.85" />
          <rect x="22" y="14" width="8" height="7" rx="1.5" fill="#fff" opacity="0.85" />
          <circle cx="12" cy="32" r="4" fill="#2c2f38" />
          <circle cx="28" cy="32" r="4" fill="#2c2f38" />
        </>
      );
      break;
    case "egg":
      art = (
        <>
          <ellipse cx="20" cy="22" rx="12" ry="15" fill={f} stroke={e} strokeWidth="1.5" />
          <circle cx="15" cy="17" r="2.5" fill={c.tens} />
          <circle cx="24" cy="26" r="3" fill={c.tens} />
        </>
      );
      break;
    case "star":
      art = <path d="M20 4 l4.7 9.6 10.6 1.5 -7.7 7.5 1.8 10.5 -9.4 -5 -9.4 5 1.8 -10.5 -7.7 -7.5 10.6 -1.5 z" fill={f} stroke={e} strokeWidth="1.5" strokeLinejoin="round" />;
      break;
    case "shell":
      art = (
        <>
          <path d="M20 6 q14 4 14 18 q-14 12 -28 0 q0 -14 14 -18 z" fill={f} stroke={e} strokeWidth="1.5" />
          <path d="M20 8 v24 M13 11 l4 20 M27 11 l-4 20" stroke={e} strokeWidth="1.2" />
        </>
      );
      break;
    case "cookie":
      // Food keeps its own colour: a blue cookie is a puzzle of its own.
      art = (
        <>
          <circle cx="20" cy="20" r="14" fill="#d9a05b" stroke="#8a5a1f" strokeWidth="1.5" />
          {[[14, 15], [24, 13], [26, 23], [15, 25], [20, 20]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="2" fill="#5a3a10" />)}
        </>
      );
      break;
    case "ball":
      art = (
        <>
          <circle cx="20" cy="20" r="14" fill={f} stroke={e} strokeWidth="1.5" />
          <path d="M6 20 h28 M20 6 q-8 14 0 28 M20 6 q8 14 0 28" stroke="#fff" strokeWidth="2" fill="none" opacity="0.8" />
        </>
      );
      break;
    case "apple":
      art = (
        <>
          <path d="M20 12 q-14 -6 -14 10 q0 14 14 14 q14 0 14 -14 q0 -16 -14 -10 z" fill="#e0564a" stroke="#9b2c1f" strokeWidth="1.5" />
          <path d="M20 12 q1 -5 4 -7" stroke="#6b4524" strokeWidth="2" fill="none" />
          <path d="M22 8 q6 -4 8 1 q-5 2 -8 -1 z" fill="#5aa05a" />
        </>
      );
      break;
    case "car":
      art = (
        <>
          <path d="M5 26 v-6 l6 -8 h16 l6 8 v6 z" fill={f} stroke={e} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M13 13 h13 l4 6 h-21 z" fill="#fff" opacity="0.8" />
          <circle cx="12" cy="28" r="4" fill="#2c2f38" />
          <circle cx="28" cy="28" r="4" fill="#2c2f38" />
        </>
      );
      break;
    case "flower":
      art = (
        <>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="20" cy="11" rx="6" ry="8" fill={f} stroke={e} strokeWidth="1.2" transform={`rotate(${a} 20 20)`} />
          ))}
          <circle cx="20" cy="20" r="5" fill="#f4c542" />
        </>
      );
      break;
    case "candy":
      art = (
        <>
          <path d="M8 20 l-5 -6 v12 z M32 20 l5 -6 v12 z" fill={e} />
          <circle cx="20" cy="20" r="11" fill={f} stroke={e} strokeWidth="1.5" />
          <path d="M13 15 q7 10 14 0" stroke="#fff" strokeWidth="2" fill="none" opacity="0.8" />
        </>
      );
      break;
    default:
      art = (
        <>
          <rect x="7" y="7" width="26" height="26" rx="5" fill={f} stroke={e} strokeWidth="1.5" />
          <circle cx="20" cy="20" r="5" fill="#fff" opacity="0.7" />
        </>
      );
  }
  return (
    <svg {...common} style={style}>
      {art}
      {cross}
    </svg>
  );
}

/**
 * The progress jar. It fills by one step for every puzzle solved this
 * session, and carries a running total across sessions. In the honey world
 * it is Pooh's honey jar; in the others the same jar holds that world's treasure.
 */
export function Jar({
  world,
  filled,
  of,
  total,
  label,
  size = 110,
}: {
  world: World;
  filled: number;
  of: number;
  total?: number;
  label: string;
  size?: number;
}) {
  const c = world.colours;
  const frac = Math.max(0, Math.min(1, filled / of));
  const top = 34;
  const bottom = 112;
  const level = bottom - (bottom - top) * frac;
  const id = `jar-${world.id}-${world.icon}`;
  return (
    <figure className="flex flex-col items-center gap-1" aria-label={`${label}: ${filled} of ${of}`}>
      <svg width={size} height={(size * 124) / 100} viewBox="0 0 100 124">
        <defs>
          <clipPath id={id}>
            <path d="M22 30 q-8 10 -8 30 v40 q0 16 16 16 h40 q16 0 16 -16 v-40 q0 -20 -8 -30 z" />
          </clipPath>
          <linearGradient id={`${id}-g`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={c.fill} stopOpacity="0.85" />
            <stop offset="1" stopColor={c.fill} />
          </linearGradient>
        </defs>
        <path d="M22 30 q-8 10 -8 30 v40 q0 16 16 16 h40 q16 0 16 -16 v-40 q0 -20 -8 -30 z" fill="#ffffff" opacity="0.7" />
        <g clipPath={`url(#${id})`}>
          <rect
            x="0"
            y={level}
            width="100"
            height={130 - level}
            fill={`url(#${id}-g)`}
            style={{ transition: "y 900ms cubic-bezier(.3,1.4,.5,1), height 900ms cubic-bezier(.3,1.4,.5,1)" }}
          />
          <path
            d={`M0 ${level} q12 -5 25 0 t25 0 t25 0 t25 0 v6 h-100 z`}
            fill={c.fill}
            style={{ transition: "d 900ms ease" }}
          />
        </g>
        <path d="M22 30 q-8 10 -8 30 v40 q0 16 16 16 h40 q16 0 16 -16 v-40 q0 -20 -8 -30 z" fill="none" stroke="#8a6a3a" strokeWidth="3" opacity="0.55" />
        <rect x="18" y="18" width="64" height="14" rx="5" fill={world.icon === "honeypot" ? "#a86d2b" : c.beadEdge} />
        <path d="M28 48 q-4 14 0 36" stroke="#fff" strokeWidth="4" opacity="0.55" fill="none" strokeLinecap="round" />
        {world.icon === "honeypot" && (
          <text x="50" y="76" textAnchor="middle" fontSize="13" fontWeight="800" fill="#6b4524" opacity="0.8" fontFamily="var(--font-display)">
            HUNNY
          </text>
        )}
      </svg>
      <figcaption className="text-sm font-semibold text-[var(--ink-soft)]">
        {label} · {filled}/{of}
        {total !== undefined && total > 0 ? <span className="opacity-70"> · {total} saved</span> : null}
      </figcaption>
    </figure>
  );
}
