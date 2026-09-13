"use client";

import type { CharacterId } from "@/lib/theme";
import { CHARACTERS } from "@/lib/theme";

/**
 * Sprites are abstract roles, not pictures of the interest. A generated
 * stem picks a spriteKey from a fixed set, so no model output ever reaches
 * an image path — the validator enforces membership and there is nothing
 * to render for a key that does not exist.
 */
export function Sprite({ spriteKey, size = 64 }: { spriteKey: string; size?: number }) {
  const s = size;
  const stroke = "var(--accent)";
  const fill = "var(--accent-soft)";

  const shapes: Record<string, React.ReactNode> = {
    "group-a": (
      <>
        <circle cx="20" cy="26" r="11" fill={fill} stroke={stroke} strokeWidth="2.5" />
        <circle cx="44" cy="26" r="11" fill={fill} stroke={stroke} strokeWidth="2.5" />
        <circle cx="32" cy="46" r="11" fill={fill} stroke={stroke} strokeWidth="2.5" />
      </>
    ),
    "group-b": (
      <>
        <rect x="9" y="15" width="19" height="19" rx="4" fill={fill} stroke={stroke} strokeWidth="2.5" />
        <rect x="36" y="15" width="19" height="19" rx="4" fill={fill} stroke={stroke} strokeWidth="2.5" />
        <rect x="22" y="38" width="19" height="19" rx="4" fill={fill} stroke={stroke} strokeWidth="2.5" />
      </>
    ),
    container: (
      <>
        <path d="M14 22 h36 l-5 30 h-26 z" fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
        <line x1="10" y1="22" x2="54" y2="22" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
      </>
    ),
    row: (
      <>
        {[12, 26, 40, 54].map((x) => (
          <rect key={x} x={x - 5} y="22" width="10" height="20" rx="3" fill={fill} stroke={stroke} strokeWidth="2.5" />
        ))}
      </>
    ),
    single: <circle cx="32" cy="32" r="16" fill={fill} stroke={stroke} strokeWidth="2.5" />,
  };

  return (
    <svg width={s} height={s} viewBox="0 0 64 64" role="presentation" aria-hidden="true">
      {shapes[spriteKey] ?? shapes.single}
    </svg>
  );
}

/**
 * The character's moods. Deliberately small, non-verbal changes: a
 * companion that is present rather than a performer that celebrates.
 *
 * There is no "wrong" mood, because there is no wrong answer in this app —
 * an unexpected build is information, and a character pulling a sad face at
 * a child for it would undo the entire premise.
 */
export type Mood = "calm" | "watching" | "alongside" | "pleased" | "thinking";

export function CharacterMark({
  id,
  size = 48,
  mood = "calm",
}: {
  id: CharacterId;
  size?: number;
  mood?: Mood;
}) {
  const glyph = CHARACTERS[id].glyph;
  const fill = "var(--accent-soft)";
  const stroke = "var(--accent)";
  const ink = "var(--ink)";

  const body: Record<string, React.ReactNode> = {
    circle: <circle cx="32" cy="32" r="20" fill={fill} stroke={stroke} strokeWidth="3" />,
    square: <rect x="12" y="12" width="40" height="40" rx="8" fill={fill} stroke={stroke} strokeWidth="3" />,
    triangle: <path d="M32 10 L54 52 H10 Z" fill={fill} stroke={stroke} strokeWidth="3" strokeLinejoin="round" />,
    hexagon: <path d="M32 9 L53 21 V43 L32 55 L11 43 V21 Z" fill={fill} stroke={stroke} strokeWidth="3" strokeLinejoin="round" />,
  };

  // eyes: [radius, yOffset]; mouth: a path
  const face: Record<Mood, { eyeR: number; eyeY: number; mouth: string }> = {
    calm: { eyeR: 2.6, eyeY: 29, mouth: "M26 39 q6 3 12 0" },
    watching: { eyeR: 3.4, eyeY: 28, mouth: "M26 38.5 q6 3.5 12 0" },
    alongside: { eyeR: 2.6, eyeY: 29, mouth: "M26 38 q6 5 12 0" },
    pleased: { eyeR: 2.2, eyeY: 29, mouth: "M25 37 q7 7 14 0" },
    thinking: { eyeR: 2.6, eyeY: 30, mouth: "M27 40 q5 -3 10 0" },
  };
  const f = face[mood];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={`${CHARACTERS[id].label}, ${mood}`}
    >
      {body[glyph]}
      <circle cx="26" cy={f.eyeY} r={f.eyeR} fill={ink} />
      <circle cx="38" cy={f.eyeY} r={f.eyeR} fill={ink} />
      <path d={f.mouth} fill="none" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
      {mood === "thinking" && (
        <circle cx="48" cy="18" r="2.5" fill="none" stroke={stroke} strokeWidth="2" />
      )}
    </svg>
  );
}
