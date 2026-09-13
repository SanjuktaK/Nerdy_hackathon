"use client";

import { useState } from "react";
import { Button, Field, Panel, inputClass } from "./Bits";
import { CharacterMark, Sprite } from "@/components/child/Sprite";
import {
  CHARACTERS,
  PALETTES,
  SEED_INTERESTS,
  paletteCssVars,
  sanitiseInterest,
  type CharacterId,
  type PaletteId,
  type SensoryLevel,
  type Theme,
} from "@/lib/theme";

/**
 * §8 rules, enforced by this component:
 *   parent-controlled · swappable any time · previewed before taking effect
 *   · invariant (nothing here can touch a number) · conservative defaults.
 */
export function ThemeControls({
  theme,
  canGenerate,
  onApply,
}: {
  theme: Theme;
  /** False when the resolved provider is `none`: the free-text field is hidden. */
  canGenerate: boolean;
  onApply: (t: Theme) => void;
}) {
  const [draft, setDraft] = useState<Theme>(theme);
  const dirty = JSON.stringify(draft) !== JSON.stringify(theme);
  const set = <K extends keyof Theme>(k: K, v: Theme[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <Panel
      title="Look, sound and interest"
      note="Changes apply when you press Apply, never mid-task. A change here alters the pictures, the nouns and the colours. It never alters the numbers, the difficulty, or the skill."
      action={
        <div className="flex gap-2">
          <Button onClick={() => setDraft(theme)} disabled={!dirty}>
            Undo
          </Button>
          <Button tone="primary" onClick={() => onApply(draft)} disabled={!dirty}>
            Apply
          </Button>
        </div>
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          {canGenerate ? (
            <Field
              label="Interest"
              hint="Any words. If the lesson bank has nothing for it, one is written for this child and then kept."
            >
              <input
                className={inputClass}
                value={draft.interest}
                maxLength={40}
                onChange={(e) => set("interest", sanitiseInterest(e.target.value))}
                placeholder="washing machines"
              />
            </Field>
          ) : (
            <Field
              label="Interest"
              hint="No language model is available on this device, so the app is using its built-in lessons only."
            >
              <select
                className={inputClass}
                value={SEED_INTERESTS.includes(draft.interest as never) ? draft.interest : SEED_INTERESTS[0]}
                onChange={(e) => set("interest", e.target.value)}
              >
                {SEED_INTERESTS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Character">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CHARACTERS) as CharacterId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => set("character", id)}
                  aria-pressed={draft.character === id}
                  className={`rounded-xl border-2 px-3 py-2 ${
                    draft.character === id ? "border-[var(--accent)]" : "border-[var(--line)]"
                  }`}
                >
                  <CharacterMark id={id} size={36} />
                </button>
              ))}
            </div>
          </Field>

          <Field label="Colours" hint="Muted sets only.">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PALETTES) as PaletteId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => set("palette", id)}
                  aria-pressed={draft.palette === id}
                  className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm ${
                    draft.palette === id ? "border-[var(--accent)]" : "border-[var(--line)]"
                  }`}
                >
                  <span
                    className="h-5 w-5 rounded-full border"
                    style={{
                      background: PALETTES[id].tokens.accent,
                      borderColor: PALETTES[id].tokens.line,
                    }}
                  />
                  {PALETTES[id].label}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Sound: ${["off", "quiet", "full"][draft.soundLevel]}`}>
              <input
                type="range"
                min={0}
                max={2}
                value={draft.soundLevel}
                onChange={(e) => set("soundLevel", Number(e.target.value) as SensoryLevel)}
              />
            </Field>
            <Field label={`Movement: ${["none", "calm", "full"][draft.motionLevel]}`}>
              <input
                type="range"
                min={0}
                max={2}
                value={draft.motionLevel}
                onChange={(e) => set("motionLevel", Number(e.target.value) as SensoryLevel)}
              />
            </Field>
          </div>

          <Field label={`Reading speed: ${draft.narrationSpeed.toFixed(2)}×`}>
            <input
              type="range"
              min={0.6}
              max={1.2}
              step={0.05}
              value={draft.narrationSpeed}
              onChange={(e) => set("narrationSpeed", Number(e.target.value))}
            />
          </Field>
        </div>

        {/* Previewed before taking effect (§8). */}
        <div
          style={paletteCssVars(draft.palette)}
          className="rounded-2xl border-2 border-[var(--line)] bg-[var(--bg)] p-5"
        >
          <p className="mb-3 text-sm uppercase tracking-wide text-[var(--ink-soft)]">Preview</p>
          <div className="rounded-2xl border-2 border-[var(--line)] bg-[var(--surface)] p-5 text-[var(--ink)]">
            <div className="flex items-center gap-3">
              <CharacterMark id={draft.character} size={44} />
              <p className="text-lg">Next: 3 number tasks. Then a break.</p>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Sprite spriteKey="container" size={44} />
              <p className="text-lg">A sentence about {draft.interest || "the chosen interest"}.</p>
            </div>
            <div className="mt-4 flex gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <span
                  key={i}
                  className="h-8 w-8 rounded-full border-2"
                  style={{
                    borderColor: "var(--line)",
                    background: i < 3 ? "var(--accent)" : "var(--bg)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
