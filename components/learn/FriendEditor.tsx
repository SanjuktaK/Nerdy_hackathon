"use client";

// ============================================================
// Edit the child's friend directly. Every control here changes exactly what
// is drawn — no model in between — so what the grown-up picks is what the
// child sees.
// ============================================================

import type { Character, IconId } from "@/lib/learn/types";
import { BUDDIES, BUDDY_COLOURS, shade, tint, worldOf, type World } from "@/lib/learn/worlds";

import { CharacterArt } from "./Character";
import { ItemIcon } from "./Items";

const ACCESSORIES: { id: Character["accessory"]; label: string }[] = [
  { id: "none", label: "Nothing" },
  { id: "scarf", label: "Scarf" },
  { id: "hat", label: "Hat" },
  { id: "cap", label: "Cap" },
  { id: "bow", label: "Bow" },
];

const THINGS: { icon: IconId; one: string; many: string }[] = [
  { icon: "honeypot", one: "honey pot", many: "honey pots" },
  { icon: "cookie", one: "cookie", many: "cookies" },
  { icon: "apple", one: "apple", many: "apples" },
  { icon: "ball", one: "ball", many: "balls" },
  { icon: "star", one: "star", many: "stars" },
  { icon: "car", one: "car", many: "cars" },
  { icon: "carriage", one: "carriage", many: "carriages" },
  { icon: "flower", one: "flower", many: "flowers" },
  { icon: "candy", one: "sweet", many: "sweets" },
  { icon: "egg", one: "egg", many: "eggs" },
  { icon: "shell", one: "shell", many: "shells" },
  { icon: "block", one: "block", many: "blocks" },
];

const clean = (s: string, max = 24) => s.replace(/[^\p{L} '-]/gu, "").slice(0, max);

export function FriendEditor({
  character,
  onChange,
  filter,
}: {
  character: Character;
  onChange: (c: Character) => void;
  filter?: string;
}) {
  const w = worldOf(character);
  // Any edit makes the world the character's own, so it is never swapped back
  // for the built-in one.
  const set = (patch: Partial<Character>, skin: Partial<World> = {}) =>
    onChange({ ...character, ...patch, skin: { ...w, ...skin, id: "custom", hero: patch.name ?? character.name } });

  const recolour = (hex: string) =>
    set(
      { body: hex },
      { colours: { ...w.colours, body: hex, bead: hex, beadEdge: shade(hex), fill: hex, sky: tint(hex, 0.86) } }
    );

  return (
    <section className="panel flex flex-col gap-5 p-6">
      <h2 className="font-display text-2xl font-bold">{character.name}, the friend</h2>
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-[var(--bg)] p-4" style={{ filter }}>
          <CharacterArt character={character} mood="happy" size={170} />
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <ItemIcon key={i} world={w} size={30} />
            ))}
          </div>
          <span className="text-sm text-[var(--ink-soft)]">counts {w.item.many} into the {w.jar}</span>
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Name</span>
            <input className="field max-w-xs" value={character.name} maxLength={24} onChange={(e) => set({ name: clean(e.target.value) })} />
          </label>

          <div className="flex flex-col gap-2">
            <span className="font-semibold">Looks like</span>
            <div className="flex flex-wrap gap-2">
              {BUDDIES.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={w.body === b.id}
                  onClick={() => set({}, { body: b.id, heroKind: b.kind })}
                  className={`chip ${w.body === b.id ? "chip-on" : ""}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-semibold">Colour</span>
            <div className="flex flex-wrap gap-2">
              {BUDDY_COLOURS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={c.name}
                  aria-label={c.name}
                  aria-pressed={character.body === c.hex}
                  onClick={() => recolour(c.hex)}
                  className={`h-9 w-9 rounded-full border-4 shadow ${character.body === c.hex ? "border-[var(--accent-strong)]" : "border-white"}`}
                  style={{ background: c.hex }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-semibold">Wears</span>
            <div className="flex flex-wrap gap-2">
              {ACCESSORIES.map((a) => (
                <button key={a.id} type="button" aria-pressed={character.accessory === a.id} onClick={() => set({ accessory: a.id })} className={`chip ${character.accessory === a.id ? "chip-on" : ""}`}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-semibold">Counts</span>
            <div className="flex flex-wrap gap-2">
              {THINGS.map((t) => (
                <button
                  key={t.icon}
                  type="button"
                  aria-pressed={w.icon === t.icon}
                  onClick={() => set({ treasure: t.one }, { icon: t.icon, item: { one: t.one, many: t.many }, treasure: t.one })}
                  className={`chip inline-flex items-center gap-1.5 ${w.icon === t.icon ? "chip-on" : ""}`}
                >
                  <ItemIcon world={{ ...w, icon: t.icon }} size={20} />
                  {t.many}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="font-semibold">Keeps them in</span>
            <input className="field max-w-xs" value={w.jar} maxLength={24} onChange={(e) => set({}, { jar: clean(e.target.value) || "jar" })} />
          </label>
        </div>
      </div>
    </section>
  );
}
