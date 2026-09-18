"use client";

// ============================================================
// The four ways a right answer is marked, chosen by the caregiver:
//   woohoo — a big cheer: sound, a jump, the world's items raining down
//   chime  — a soft two-note chime and a glow
//   smile  — no sound; the character smiles
//   quiet  — a small tick, nothing else
// There is no "wrong" animation in any style. A wrong answer is information.
// ============================================================

import { useEffect, useMemo } from "react";

import { playChime, playWoohoo } from "@/lib/learn/sound";
import type { Character, CheerStyle } from "@/lib/learn/types";
import { worldOf } from "@/lib/learn/worlds";

import { CharacterArt } from "./Character";
import { ItemIcon } from "./Items";

export const CHEER_OPTIONS: { id: CheerStyle; title: string; blurb: string }[] = [
  { id: "woohoo", title: "Big cheer", blurb: "A “woo hoo!” sound, a jump and a shower of stars." },
  { id: "chime", title: "Soft chime", blurb: "A gentle two-note chime and a glow." },
  { id: "smile", title: "Just a smile", blurb: "No sound. The character smiles." },
  { id: "quiet", title: "Quiet tick", blurb: "A small tick mark. Nothing else." },
];

export function playCheerSound(style: CheerStyle, soundSensitive: boolean) {
  if (style === "woohoo") playWoohoo(soundSensitive);
  else if (style === "chime") playChime(soundSensitive);
}

export function Cheer({
  style,
  character,
  soundSensitive,
  line,
}: {
  style: CheerStyle;
  character: Character;
  soundSensitive: boolean;
  line: string;
}) {
  useEffect(() => {
    playCheerSound(style, soundSensitive);
  }, [style, soundSensitive]);

  const drops = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: (i % 6) * 0.12,
        dur: 1.6 + ((i * 13) % 7) / 10,
      })),
    []
  );

  if (style === "quiet") {
    return (
      <div className="flex flex-col items-center gap-3 py-8" role="status">
        <svg width="72" height="72" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="11" fill="var(--accent-soft)" />
          <path d="M7 12.5l3.2 3.2L17 9" stroke="var(--accent-strong)" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="font-display text-2xl">Done.</p>
      </div>
    );
  }

  return (
    <div className="relative flex w-full flex-col items-center gap-3 overflow-hidden py-6" role="status">
      {style === "woohoo" &&
        drops.map((d, i) => (
          <span
            key={i}
            className="confetti"
            style={{ left: `${d.left}%`, animationDelay: `${d.delay}s`, animationDuration: `${d.dur}s` }}
            aria-hidden="true"
          >
            <ItemIcon world={worldOf(character)} size={28} />
          </span>
        ))}
      {style === "chime" && <span className="glow-ring" aria-hidden="true" />}
      <span className={style === "woohoo" ? "animate-jump" : "animate-breathe"}>
        <CharacterArt character={character} mood={style === "woohoo" ? "cheer" : "happy"} size={190} />
      </span>
      <p className={`font-display font-bold ${style === "woohoo" ? "text-5xl text-[var(--hot)]" : "text-3xl"}`}>
        {style === "woohoo" ? "Woo hoo!" : style === "chime" ? "Well done." : "You did it."}
      </p>
      <p className="text-lg text-[var(--ink-soft)]">{line}</p>
    </div>
  );
}
