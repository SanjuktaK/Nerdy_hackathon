"use client";

// Controls shared by first-run setup and the grown-ups page, so a setting
// looks and behaves the same wherever a caregiver meets it.

import { MONO_TONES, READ_ALOUD_OPTIONS } from "@/lib/learn/sensory";
import { useState } from "react";

import { setVolume, sfxBead, speak } from "@/lib/learn/sound";
import type { Character, MonoTone, ReadAloud } from "@/lib/learn/types";
import { worldOf } from "@/lib/learn/worlds";

import { CharacterArt } from "./Character";
import { ItemIcon } from "./Items";

/** Pick the one calm colour the whole app is shown in, with a live preview. */
export function TonePicker({
  value,
  onChange,
  character,
}: {
  value: MonoTone | undefined;
  onChange: (t: MonoTone) => void;
  character: Character;
}) {
  const current = MONO_TONES.find((t) => t.id === value) ?? MONO_TONES[0];
  const w = worldOf(character);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Calm colour">
        {MONO_TONES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={current.id === t.id}
            onClick={() => onChange(t.id)}
            className={`chip inline-flex items-center gap-2 ${current.id === t.id ? "chip-on" : ""}`}
          >
            <span className="h-4 w-4 rounded-full" style={{ background: t.swatch }} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>
      <div
        className="flex items-center justify-center gap-4 rounded-2xl bg-[var(--bg)] p-4"
        style={{ filter: current.filter }}
        aria-label={`Preview in ${current.label}`}
      >
        <CharacterArt character={character} mood="happy" size={96} />
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <ItemIcon key={i} world={w} size={34} />
          ))}
        </div>
        <span className="rounded-full px-4 py-2 font-display font-semibold" style={{ background: "var(--glow-strong)" }}>
          Next
        </span>
      </div>
    </div>
  );
}

export function ReadAloudPicker({ value, onChange }: { value: ReadAloud; onChange: (r: ReadAloud) => void }) {
  const [result, setResult] = useState<string>("");
  const test = async () => {
    setResult("Speaking…");
    const path = await speak("Hello. I will read the puzzles to you.");
    setResult(
      path === "natural"
        ? "Played with the natural on-device voice (Kokoro)."
        : path === "browser"
        ? "Played with the browser's voice. For a natural voice, run: npm run tts:serve"
        : path === "mac"
          ? "The browser's voice did not start here, so the Mac's own voice is used instead."
          : "No sound could be played. Check the volume, and that this page is not muted."
    );
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-3 sm:grid-cols-3">
        {READ_ALOUD_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
            className={`option ${value === o.id ? "option-on" : ""}`}
          >
            <span className="font-display text-lg font-bold">{o.title}</span>
            <span className="text-[15px] leading-snug text-[var(--ink-soft)]">{o.blurb}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary min-h-0! px-4! py-1.5! text-base!" onClick={test}>
          Test the voice
        </button>
        <span className="text-sm text-[var(--ink-soft)]" role="status">{result}</span>
      </div>
    </div>
  );
}

/** Master volume, with a sample sound so the level is heard, not guessed. */
export function VolumeSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-semibold">Volume: {Math.round(value * 100)}%</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        onChange={(e) => {
          const v = Number(e.target.value) / 100;
          setVolume(v);
          onChange(v);
        }}
        onPointerUp={() => sfxBead("ones", true)}
        className="w-full max-w-sm accent-[var(--accent-strong)]"
      />
    </label>
  );
}
