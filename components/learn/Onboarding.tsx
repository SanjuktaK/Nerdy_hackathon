"use client";

// ============================================================
// First open: a few questions for the caregiver, one at a time.
//
// The answers become the JSON the model reads to build the companion and
// plan every question. The last step is consent: whether the app may
// change difficulty and update the child's learning profile from the
// answers. Without it the app still works, at a fixed level.
// ============================================================

import { useState } from "react";

import { GRADES, gradeForAge } from "@/lib/learn/curriculum";
import type { Character, ChildProfile, CheerStyle, Communication, GradeBand, SupportLevel } from "@/lib/learn/types";
import { BUDDIES, BUDDY_COLOURS, WORLDS, WORLD_ORDER, buddyById, buddyWorld, paintBuddy } from "@/lib/learn/worlds";

import { CharacterArt } from "./Character";
import { CHEER_OPTIONS, playCheerSound } from "./Cheer";
import { ReadAloudPicker, TonePicker } from "./SettingsPickers";
import { sensoryFilter } from "@/lib/learn/sensory";

const SHOW_CHIPS = ["Winnie the Pooh", "Shinchan", "Paw Patrol", "Peppa Pig", "Thomas & Friends", "Bluey"];

type Draft = Omit<ChildProfile, "createdAt">;

const DEFAULT: Draft = {
  name: "",
  age: 6,
  grade: "G1",
  support: "some",
  communication: "phrases",
  colourSensitive: false,
  soundSensitive: false,
  likesStories: true,
  favouriteShow: "",
  buddy: "bear",
  world: "honey",
  cheer: "smile",
  adaptConsent: true,
};

function Option<T extends string | boolean>({
  value,
  current,
  onPick,
  title,
  blurb,
}: {
  value: T;
  current: T;
  onPick: (v: T) => void;
  title: string;
  blurb?: string;
}) {
  const on = value === current;
  return (
    <button type="button" onClick={() => onPick(value)} aria-pressed={on} className={`option ${on ? "option-on" : ""}`}>
      <span className="font-display text-xl font-bold">{title}</span>
      {blurb && <span className="text-[15px] leading-snug text-[var(--ink-soft)]">{blurb}</span>}
    </button>
  );
}

export function Onboarding({ onDone }: { onDone: (p: ChildProfile, c: Character) => void }) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(DEFAULT);
  const [creating, setCreating] = useState(false);
  const [made, setMade] = useState<Character | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const who = d.name.trim() || "your child";
  // A preview only: the real world is designed by the model at the last step.
  const hint = WORLDS[d.world === "custom" ? "honey" : d.world];
  const customShow = d.likesStories && d.favouriteShow.trim() !== "" && !/pooh|winnie/i.test(d.favouriteShow);
  const showWorld = (show: string) => (show.trim() && !/pooh|winnie/i.test(show) ? "custom" : "honey");

  const steps = [
    "welcome",
    "about",
    "support",
    "senses",
    "stories",
    "cheer",
    "consent",
    "create",
  ] as const;
  const at = steps[step];

  const create = async () => {
    setStep(steps.indexOf("create"));
    setCreating(true);
    const profile: ChildProfile = { ...d, createdAt: Date.now() };
    const t0 = Date.now();
    let c: Character;
    try {
      const r = await fetch("/api/learn/character", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      c = ((await r.json()) as { character: Character }).character;
    } catch {
      const w = hint;
      c = {
        skin: w,
        name: w.hero,
        world: w.id,
        body: d.colourSensitive ? "#9a9a9a" : w.colours.body,
        accent: d.colourSensitive ? "#5f5f5f" : w.colours.accent,
        accessory: "scarf",
        catchphrase: "We count together.",
        treasure: w.treasure,
        source: "fallback",
      };
    }
    // Let the reveal breathe: a character that pops out in 200 ms feels like a glitch.
    await new Promise((r) => setTimeout(r, Math.max(0, 2600 - (Date.now() - t0))));
    setMade(c);
    setCreating(false);
  };

  const canNext = at !== "about" || d.age >= 4;
  const nextBtn = (label = "Next") => (
    <button type="button" className="btn-primary self-end" disabled={!canNext} onClick={() => (at === "consent" ? create() : setStep(step + 1))}>
      {label}
    </button>
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6 flex items-center justify-between">
        <span className="font-display text-xl font-bold">Tally Tales</span>
        {at !== "welcome" && at !== "create" && (
          <span className="text-sm font-semibold text-[var(--ink-soft)]">
            Step {step} of {steps.length - 2}
          </span>
        )}
      </header>
      {at !== "welcome" && at !== "create" && (
        <div className="mb-6 h-2 overflow-hidden rounded-full bg-[var(--line)]" aria-hidden="true">
          <div className="h-full rounded-full bg-[var(--accent-strong)] transition-all" style={{ width: `${(step / (steps.length - 2)) * 100}%` }} />
        </div>
      )}

      <section className="panel flex flex-1 flex-col gap-6 p-6 sm:p-10">
        {at === "welcome" && (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex items-end gap-2">
              {WORLD_ORDER.slice(0, 3).map((w) => (
                <CharacterArt
                  key={w}
                  size={w === "honey" ? 150 : 100}
                  mood="happy"
                  character={{ name: WORLDS[w].hero, world: w, body: WORLDS[w].colours.body, accent: WORLDS[w].colours.accent, accessory: w === "honey" ? "none" : "scarf", catchphrase: "", treasure: "", source: "fallback" }}
                />
              ))}
            </div>
            <h1 className="font-display text-4xl font-bold sm:text-5xl">Hello, grown-up.</h1>
            <p className="max-w-lg text-lg text-[var(--ink-soft)]">
              A few questions help us shape the maths, the colours and the story around your child. It takes about two minutes.
              Everything stays on this device, and the AI runs on this computer.
            </p>
            <button type="button" className="btn-primary" onClick={() => setStep(1)}>
              Let’s start
            </button>
          </div>
        )}

        {at === "about" && (
          <>
            <h2 className="q-title">Who is learning?</h2>
            <label className="flex flex-col gap-2">
              <span className="font-semibold">First name or nickname</span>
              <input
                className="field"
                value={d.name}
                maxLength={30}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Sam"
                autoComplete="off"
              />
            </label>
            <div className="flex flex-col gap-2">
              <span className="font-semibold">Age</span>
              <div className="flex items-center gap-4">
                <button type="button" className="step-btn" onClick={() => { const a = Math.max(4, d.age - 1); setD((x) => ({ ...x, age: a, grade: gradeForAge(a) })); }} aria-label="Younger">−</button>
                <span className="w-16 text-center font-display text-4xl font-bold tabular-nums">{d.age}</span>
                <button type="button" className="step-btn" onClick={() => { const a = Math.min(12, d.age + 1); setD((x) => ({ ...x, age: a, grade: gradeForAge(a) })); }} aria-label="Older">+</button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-semibold">School year (we suggested one from the age)</span>
              <div className="grid gap-2 sm:grid-cols-3">
                {GRADES.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    disabled={!g.available}
                    aria-pressed={d.grade === g.id}
                    onClick={() => set("grade", g.id as GradeBand)}
                    className={`option ${d.grade === g.id ? "option-on" : ""}`}
                  >
                    <span className="font-display text-lg font-bold">
                      {g.label} <span className="font-normal text-[var(--ink-soft)]">· ages {g.ages}</span>
                    </span>
                    <span className="text-sm leading-snug text-[var(--ink-soft)]">{g.available ? g.topics : "Coming soon"}</span>
                  </button>
                ))}
              </div>
              <p className="text-sm text-[var(--ink-soft)]">This demo covers Kindergarten to 2nd grade. 3rd to 5th grade are planned next.</p>
            </div>
            {nextBtn()}
          </>
        )}

        {at === "support" && (
          <>
            <h2 className="q-title">How much help does {who} usually need with a new task?</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                ["light", "A little", "Picks up new things quickly with an example."],
                ["some", "Some", "Needs a demo and a second go."],
                ["lots", "A lot", "Needs slow steps, repeats and a calm pace."],
              ] as [SupportLevel, string, string][]).map(([v, t, b]) => (
                <Option key={v} value={v} current={d.support} onPick={(x) => set("support", x)} title={t} blurb={b} />
              ))}
            </div>
            <h2 className="q-title mt-2">How does {who} usually communicate?</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                ["sentences", "Full sentences", ""],
                ["phrases", "Short phrases", ""],
                ["few-words", "A few words, or none", "We will read everything aloud."],
              ] as [Communication, string, string][]).map(([v, t, b]) => (
                <Option key={v} value={v} current={d.communication} onPick={(x) => set("communication", x)} title={t} blurb={b || undefined} />
              ))}
            </div>
            {nextBtn()}
          </>
        )}

        {at === "senses" && (
          <>
            <h2 className="q-title">Do bright or changing colours upset {who}?</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Option value={true} current={d.colourSensitive} onPick={(x) => set("colourSensitive", x)} title="Yes" blurb="The whole app stays in one calm colour you choose." />
              <Option value={false} current={d.colourSensitive} onPick={(x) => set("colourSensitive", x)} title="No, colours are fine" blurb="Warm colours, and the beads take the story’s colours." />
            </div>
            {d.colourSensitive && (
              <TonePicker
                value={d.monoTone}
                onChange={(t) => set("monoTone", t)}
                character={{ name: "", world: "honey", skin: hint, body: hint.colours.body, accent: hint.colours.accent, accessory: "scarf", catchphrase: "", treasure: "", source: "fallback" }}
              />
            )}
            <h2 className="q-title">Are sounds sometimes too much?</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Option value={true} current={d.soundSensitive} onPick={(x) => { set("soundSensitive", x); if (x && d.cheer === "woohoo") set("cheer", "smile"); }} title="Yes" blurb="Everything stays quiet or very soft." />
              <Option value={false} current={d.soundSensitive} onPick={(x) => set("soundSensitive", x)} title="No" />
            </div>
            <h2 className="q-title">Should the app read things aloud to {who}?</h2>
            <ReadAloudPicker value={d.readAloud ?? (d.age <= 6 || d.communication === "few-words" ? "auto" : "tap")} onChange={(r) => set("readAloud", r)} />
            {nextBtn()}
          </>
        )}

        {at === "stories" && (
          <>
            <h2 className="q-title">Does {who} enjoy stories or cartoons?</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Option value={true} current={d.likesStories} onPick={(x) => set("likesStories", x)} title="Yes" blurb="Each puzzle becomes a little story with their favourite character." />
              <Option value={false} current={d.likesStories} onPick={(x) => { set("likesStories", x); set("world", "honey"); set("favouriteShow", ""); set("buddy", "bear"); set("buddyColour", undefined); }} title="Not really" blurb="We will keep words short, with Pooh and his honey jar for the colour." />
            </div>
            {d.likesStories && (
              <>
                <label className="flex flex-col gap-2">
                  <span className="font-semibold">Favourite show or character</span>
                  <input
                    className="field"
                    value={d.favouriteShow}
                    maxLength={40}
                    onChange={(e) => {
                      set("favouriteShow", e.target.value);
                      set("world", showWorld(e.target.value));
                    }}
                    placeholder="e.g. Winnie the Pooh"
                    autoComplete="off"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {SHOW_CHIPS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`chip ${d.favouriteShow === s ? "chip-on" : ""}`}
                      onClick={() => {
                        set("favouriteShow", s);
                        set("world", showWorld(s));
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <span className="font-semibold">Which friend looks most like {d.favouriteShow.trim() || "their favourite"}?</span>
                  <p className="text-sm text-[var(--ink-soft)]">
                    The AI runs on this computer without the internet, so it cannot look up what a show looks like. You pick the
                    character; it names them and builds the story around them.
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {BUDDIES.map((b0) => {
                      const on = (d.buddy ?? "bear") === b0.id;
                      const b = on ? paintBuddy(b0, d.buddyColour) : b0;
                      return (
                        <button
                          key={b0.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            set("buddy", b.id);
                            set("buddyColour", undefined);
                          }}
                          className={`option items-center! gap-0! px-1! py-2! ${on ? "option-on" : ""}`}
                        >
                          <span style={{ filter: sensoryFilter(d) }}>
                            <CharacterArt
                              size={78}
                              mood={on ? "happy" : "calm"}
                              character={{ name: b.label, world: b.world ?? "custom", skin: buddyWorld(b), body: b.body, accent: b.accent, accessory: b.id === "bear" ? "none" : "scarf", catchphrase: "", treasure: "", source: "fallback" }}
                            />
                          </span>
                          <span className="text-sm font-bold">{b.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Colour">
                    <span className="mr-1 text-sm font-semibold">Colour:</span>
                    <button
                      type="button"
                      onClick={() => set("buddyColour", undefined)}
                      aria-pressed={!d.buddyColour}
                      className={`chip ${!d.buddyColour ? "chip-on" : ""}`}
                    >
                      Its own
                    </button>
                    {BUDDY_COLOURS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        title={c.name}
                        aria-label={c.name}
                        aria-pressed={d.buddyColour === c.hex}
                        onClick={() => set("buddyColour", c.hex)}
                        className={`h-9 w-9 rounded-full border-4 ${d.buddyColour === c.hex ? "border-[var(--accent-strong)]" : "border-white"} shadow`}
                        style={{ background: c.hex }}
                      />
                    ))}
                  </div>
                  <p className="text-[var(--ink-soft)]">
                    {customShow
                      ? `The on-device model will name the ${buddyById(d.buddy).label.toLowerCase()} after ${d.favouriteShow.trim()} and choose what ${who === "your child" ? "your child" : who} counts, the jar and the colours.`
                      : (d.buddy ?? "bear") === "bear"
                        ? `Pooh it is: ${who === "your child" ? "your child" : who} will count honey pots and fill Pooh’s honey jar.`
                        : `The on-device model will name the ${buddyById(d.buddy).label.toLowerCase()} and build a little world around them.`}
                  </p>
                </div>
              </>
            )}
            {nextBtn()}
          </>
        )}

        {at === "cheer" && (
          <>
            <h2 className="q-title">When {who} gets one right, what feels good?</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {CHEER_OPTIONS.map((o) => (
                <Option
                  key={o.id}
                  value={o.id}
                  current={d.cheer}
                  onPick={(x: CheerStyle) => {
                    set("cheer", x);
                    playCheerSound(x, d.soundSensitive);
                  }}
                  title={o.title}
                  blurb={o.blurb + (o.id === "woohoo" && d.soundSensitive ? " (kept soft, as sounds can be too much)" : "")}
                />
              ))}
            </div>
            <p className="text-sm text-[var(--ink-soft)]">Tap one to hear it. A wrong answer never gets a sound or a sad face — just a calm hint.</p>
            {nextBtn()}
          </>
        )}

        {at === "consent" && (
          <>
            <h2 className="q-title">May the app adapt to {who}?</h2>
            <p className="text-[var(--ink-soft)]">
              After each answer, an AI model running on this computer can choose the next puzzle — easier after a slip, harder after a
              run of right answers — and, after each session, update {who}’s learning profile. Nothing is sent to the internet. You
              can change this any time in the grown-ups page.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Option value={true} current={d.adaptConsent} onPick={(x) => set("adaptConsent", x)} title="Yes, let it adapt" blurb="Puzzles follow how they are doing." />
              <Option value={false} current={d.adaptConsent} onPick={(x) => set("adaptConsent", x)} title="No, keep it fixed" blurb="Same starting level, fixed order. The profile is not changed." />
            </div>
            {nextBtn(`Create ${d.name.trim() ? d.name.trim() + "’s" : "the"} friend`)}
          </>
        )}

        {at === "create" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center" style={{ filter: sensoryFilter(d) }}>
            {creating || !made ? (
              <>
                <div className="creating">
                  <CharacterArt size={200} character={{ name: "", world: d.world, skin: buddyWorld(paintBuddy(buddyById(d.likesStories ? d.buddy : "bear"), d.likesStories ? d.buddyColour : undefined)), body: paintBuddy(buddyById(d.likesStories ? d.buddy : "bear"), d.likesStories ? d.buddyColour : undefined).body, accent: "#999", accessory: "none", catchphrase: "", treasure: "", source: "fallback" }} />
                </div>
                <p className="font-display text-2xl">Creating a friend for {who}…</p>
                <p className="text-sm text-[var(--ink-soft)]">The on-device model is reading your answers.</p>
              </>
            ) : (
              <>
                <div className="reveal">
                  <CharacterArt size={220} mood="happy" character={made} />
                </div>
                <h2 className="font-display text-4xl font-bold">Meet {made.name}.</h2>
                <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
                  Call them
                  <input
                    className="field min-h-0! w-48 py-1! text-base!"
                    value={made.name}
                    maxLength={24}
                    onChange={(e) => {
                      const name = e.target.value.replace(/[^\p{L} '-]/gu, "");
                      setMade({ ...made, name, skin: made.skin ? { ...made.skin, hero: name } : made.skin });
                    }}
                    aria-label="Character name"
                  />
                </label>
                <p className="bubble">“{made.catchphrase}”</p>
                <p className="text-sm text-[var(--ink-soft)]">
                  {made.source === "model" ? "Designed by the on-device model from your answers." : "The model was not reachable, so this is the default friend."}{" "}
                  {made.name} is made once and stays the same every visit.
                </p>
                <button type="button" className="btn-primary" onClick={() => onDone({ ...d, createdAt: Date.now() }, { ...made, name: made.name.trim() || made.skin?.hero || "Friend" })}>
                  Hand it to {d.name.trim() || "your child"}
                </button>
              </>
            )}
          </div>
        )}
      </section>

      {at !== "welcome" && at !== "create" && (
        <button type="button" className="mt-4 self-start text-sm font-semibold text-[var(--ink-soft)] hover:underline" onClick={() => setStep(Math.max(0, step - 1))}>
          ← Back
        </button>
      )}
    </div>
  );
}
