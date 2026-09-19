"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { CharacterArt } from "@/components/learn/Character";
import { CHEER_OPTIONS, playCheerSound } from "@/components/learn/Cheer";
import { FriendEditor } from "@/components/learn/FriendEditor";
import { ReadAloudPicker, TonePicker, VolumeSlider } from "@/components/learn/SettingsPickers";
import { setEffects, setVoiceStyle } from "@/lib/learn/sound";
import { TEXT_SCALE, readAloudOf, readingClasses, sensoryFilter, sessionLengthOf, soundSettings, voiceStyleOf } from "@/lib/learn/sensory";
import { AT_HOME } from "@/lib/learn/athome";
import { computeNotes, type Note } from "@/lib/learn/notes";
import { GRADES, SKILL_LABEL, gradeInfo, nextGrade } from "@/lib/learn/curriculum";
import { MISTAKE_TEXT } from "@/lib/learn/diagnose";
import { initialModel, isMastered } from "@/lib/learn/policy";
import { getLearn, getLearnServer, resetLearn, subscribeLearn, updateLearn } from "@/lib/learn/store";
import type { Attempt, ChildProfile, LearnerModel, SkillId } from "@/lib/learn/types";
import { worldOf } from "@/lib/learn/worlds";

interface Status {
  provider: { id: string; label: string; available: boolean; model?: string };
}

export default function GrownUps() {
  const state = useSyncExternalStore(subscribeLearn, getLearn, getLearnServer);
  const [status, setStatus] = useState<Status | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const router = useRouter();

  const prof = state?.profile;
  const ch = state?.character;
  // The grown-ups page is always at normal size; the child's text size is for the child's screens.
  useEffect(() => {
    document.documentElement.style.fontSize = "100%";
  }, []);
  useEffect(() => {
    if (prof && ch) setVoiceStyle(voiceStyleOf());
  }, [prof, ch]);

  useEffect(() => {
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  if (!state) return <main className="min-h-screen" aria-busy="true" />;
  const { profile, character, sessions } = state;

  if (!profile || !character) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start gap-4 px-6 py-16">
        <h1 className="font-display text-4xl font-bold">Grown-ups</h1>
        <p className="text-lg text-[var(--ink-soft)]">Nothing is set up on this device yet.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/" className="btn-primary">Start the setup</Link>
          <ImportButton hasData={false} />
        </div>
      </main>
    );
  }

  const model = state.model ?? initialModel(profile);
  const notes = computeNotes(profile, sessions, sessionLengthOf(profile));
  const setP = (patch: Partial<ChildProfile>) => updateLearn({ profile: { ...profile, ...patch } });
  const who = profile.name || "Your child";
  const allAttempts = sessions.flatMap((s) => s.attempts);
  const right = allAttempts.filter((a) => a.correct).length;
  const skills = [...new Set([...gradeInfo(profile.grade).skills, ...(Object.keys(model.levels) as SkillId[])])];
  const allMastered = gradeInfo(profile.grade).skills.every((sk) => isMastered(sk, allAttempts));
  const next = nextGrade(profile.grade);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ app: "tally-tales", exportedAt: new Date().toISOString(), ...state }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tally-tales-${(profile.name || "child").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 font-display text-4xl font-bold">
            Grown-ups
            {notes.some((n) => !(state.seenNotes ?? []).includes(n.id)) && (
              <a href="#notes" className="note-badge text-base no-underline" aria-label="New notes">
                {notes.filter((n) => !(state.seenNotes ?? []).includes(n.id)).length}
              </a>
            )}
          </h1>
          <p className="text-[var(--ink-soft)]">Everything here is stored on this device only.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/grown-ups/report" className="btn-secondary">Report for teachers</Link>
          <Link href="/" className="btn-secondary">Back to {character.name}</Link>
        </div>
      </header>

      <NotesSection notes={notes} seen={state.seenNotes ?? []} />

      <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
        <section className="panel flex flex-col gap-4 p-6">
          <div className="flex items-center gap-4">
            <span style={{ filter: sensoryFilter(profile) }}>
              <CharacterArt character={character} mood="happy" size={96} />
            </span>
            <div>
              <h2 className="font-display text-2xl font-bold">{who}</h2>
              <p className="text-[var(--ink-soft)]">
                Age {profile.age} · {gradeInfo(profile.grade).label}
              </p>
              <p className="text-sm text-[var(--ink-soft)]">
                Friend: {character.name} ({worldOf(character).label}) ·{" "}
                {character.source === "model" ? "designed by the model" : "default design"}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[15px]">
            <dt className="text-[var(--ink-soft)]">Help needed</dt>
            <dd className="font-semibold capitalize">{profile.support === "lots" ? "a lot" : profile.support}</dd>
            <dt className="text-[var(--ink-soft)]">Communication</dt>
            <dd className="font-semibold">{profile.communication.replace("-", " ")}</dd>
            <dt className="text-[var(--ink-soft)]">Favourite show</dt>
            <dd className="font-semibold">{profile.favouriteShow || "—"}</dd>
            <dt className="text-[var(--ink-soft)]">Puzzles solved</dt>
            <dd className="font-semibold">{right} of {allAttempts.length}</dd>
          </dl>
        </section>

        <section className="panel flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-2xl font-bold">Learning profile</h2>
            <span className={`badge ${model.source === "model" ? "badge-model" : ""}`}>
              {model.source === "model" ? "updated by on-device model" : model.source === "rules" ? "updated by rules" : "starting point"}
            </span>
          </div>
          <p className="text-lg">{model.note}</p>
          <ul className="flex flex-col gap-2">
            {skills.map((s) => (
              <li key={s} className="flex items-center justify-between gap-3">
                <span>
                  {SKILL_LABEL[s]}
                  {isMastered(s, allAttempts) ? (
                    <span className="ml-2 badge badge-good">mastered ✓</span>
                  ) : (
                    <>
                      {model.strengths.includes(s) && <span className="ml-2 badge badge-good">strength</span>}
                      {model.workingOn.includes(s) && <span className="ml-2 badge">working on</span>}
                    </>
                  )}
                </span>
                <span className="flex gap-1" aria-label={`level ${model.levels[s]} of 5`}>
                  {[1, 2, 3, 4, 5].map((l) => (
                    <span key={l} className={`h-3 w-3 rounded-full ${l <= (model.levels[s] ?? 0) ? "bg-[var(--accent-strong)]" : "bg-[var(--line)]"}`} />
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-[var(--ink-soft)]">
            5 dots is the top level for the skill. Mastered means 3 answers right first time at that level; a mastered skill then only
            comes back now and then as review. {model.sessions} session{model.sessions === 1 ? "" : "s"} so far. A learning tool, not an
            assessment.
          </p>
          {allMastered && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#e8f5e6] p-3">
              <span className="font-semibold text-[#2f6a2a]">
                {next ? `Every ${gradeInfo(profile.grade).label} skill is mastered.` : "Every skill in this demo is mastered. 3rd grade is coming next."}
              </span>
              {next && (
                <button
                  type="button"
                  className="btn-primary min-h-0! px-4! py-1.5! text-base!"
                  onClick={() => setP({ grade: next.id })}
                >
                  Move up to {next.label}
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      <section className="panel flex flex-col gap-5 p-6">
        <h2 className="font-display text-2xl font-bold">About {who}</h2>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Name</span>
          <input className="field max-w-xs" value={profile.name} maxLength={30} onChange={(e) => setP({ name: e.target.value.replace(/[^\p{L} '-]/gu, "") })} />
        </label>
        <Choice
          label="School year"
          value={profile.grade}
          options={GRADES.filter((g) => g.available).map((g) => ({ id: g.id, title: g.label }))}
          onChange={(v) => setP({ grade: v as ChildProfile["grade"] })}
        />
        <Choice
          label="Help needed with a new task"
          value={profile.support}
          options={[{ id: "light", title: "A little" }, { id: "some", title: "Some" }, { id: "lots", title: "A lot" }]}
          onChange={(v) => setP({ support: v as ChildProfile["support"] })}
        />
        <Choice
          label="Puzzles before the break"
          value={String(sessionLengthOf(profile))}
          options={[{ id: "3", title: "3 puzzles" }, { id: "5", title: "5 puzzles" }, { id: "8", title: "8 puzzles" }]}
          onChange={(v) => setP({ sessionLength: Number(v) })}
        />
        <Choice
          label="How they communicate (sets story length)"
          value={profile.communication}
          options={[{ id: "sentences", title: "Full sentences" }, { id: "phrases", title: "Short phrases" }, { id: "few-words", title: "A few words, or none" }]}
          onChange={(v) => setP({ communication: v as ChildProfile["communication"] })}
        />
      </section>

      <FriendEditor character={character} onChange={(c) => updateLearn({ character: c })} filter={sensoryFilter(profile)} />

      <section className="panel flex flex-col gap-5 p-6">
        <h2 className="font-display text-2xl font-bold">Senses, voice and learning</h2>
        <Toggle label="One calm colour" hint="For children upset by bright or changing colour." on={profile.colourSensitive} onChange={(v) => setP({ colourSensitive: v })} />
        {profile.colourSensitive && <TonePicker value={profile.monoTone} onChange={(t) => setP({ monoTone: t })} character={character} />}
        <div className="flex flex-col gap-2">
          <span className="font-semibold">Read aloud</span>
          <ReadAloudPicker value={readAloudOf(profile)} onChange={(r) => setP({ readAloud: r })} />
        </div>
        <VolumeSlider value={soundSettings(profile).volume} onChange={(v) => setP({ volume: v })} />
        <Toggle label="Sound effects" hint="Bead clicks, coin clinks, a soft pop for each item counted." on={profile.soundEffects !== false} onChange={(v) => { setP({ soundEffects: v }); setEffects(v); }} />
        <Toggle label="Keep sounds soft" hint="Voice and cheers play at a lower volume." on={profile.soundSensitive} onChange={(v) => setP({ soundSensitive: v })} />
        <Choice
          label="Background"
          value={profile.background ?? "moving"}
          options={[{ id: "moving", title: "Gently moving scene" }, { id: "still", title: "Still scene" }, { id: "plain", title: "Plain" }]}
          onChange={(v) => setP({ background: v as ChildProfile["background"] })}
        />
        <Toggle
          label="Offer a break when things look hard"
          hint="Off by default: a popup mid-puzzle can itself be a distraction. When on, it looks for two tricky puzzles in a row, very quick guesses or frantic tapping (answers and taps only), and your child can always say “keep going”. The “I need a break” button is always there either way."
          on={profile.overloadCheck === true}
          onChange={(v) => setP({ overloadCheck: v })}
        />
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-[var(--line)] p-4">
          <span className="font-semibold">Reading comfort</span>
          <Choice
            label="Text size"
            value={profile.textSize ?? "normal"}
            options={[{ id: "normal", title: "Normal" }, { id: "large", title: "Large" }, { id: "xlarge", title: "Extra large" }]}
            onChange={(v) => setP({ textSize: v as ChildProfile["textSize"] })}
          />
          <Toggle label="Wider spacing" hint="More room between letters, words and lines." on={!!profile.wideSpacing} onChange={(v) => setP({ wideSpacing: v })} />
          <Toggle label="Easy-to-read font" hint="Atkinson Hyperlegible: letters and digits that are hard to mix up (1 l I, 0 O)." on={!!profile.readableFont} onChange={(v) => setP({ readableFont: v })} />
          <div
            className={`rounded-xl bg-[var(--bg)] p-3 ${readingClasses(profile)}`}
            style={{ zoom: parseFloat(TEXT_SCALE[profile.textSize ?? "normal"]) / 100 }}
            aria-label="Preview"
          >
            <p className="font-display text-2xl">{character.name} has 14 honey pots. {character.name} eats 6.</p>
            <p className="font-display text-xl font-bold text-[var(--accent-strong)]">How many are left?</p>
          </div>
        </div>
        <Toggle label="No movement" hint="Switches off every animation: bouncing, falling stars, glowing." on={!!profile.reduceMotion} onChange={(v) => setP({ reduceMotion: v })} />
        <Toggle label="Watch-first demos" hint="Show a demo the first time a skill comes up. The child can always skip it." on={profile.showDemos !== false} onChange={(v) => setP({ showDemos: v })} />
        <Toggle label="Stories" hint="Each session is a little story with the friend, sized to how your child communicates." on={profile.likesStories} onChange={(v) => setP({ likesStories: v })} />
        <div className="flex flex-col gap-2">
          <span className="font-semibold">When a puzzle is solved</span>
          <div className="flex flex-wrap gap-2">
            {CHEER_OPTIONS.map((o) => (
              <button key={o.id} type="button" className={`chip ${profile.cheer === o.id ? "chip-on" : ""}`} onClick={() => { setP({ cheer: o.id }); playCheerSound(o.id, profile.soundSensitive); }}>
                {o.title}
              </button>
            ))}
          </div>
        </div>
        <Toggle
          label="Let the app adapt"
          hint="The on-device model reads every answer and chooses the next puzzle — harder, easier, another skill or a review — and writes the progress note. Off: fixed order, fixed level."
          on={profile.adaptConsent}
          onChange={(v) => setP({ adaptConsent: v })}
        />
        <p className="text-sm text-[var(--ink-soft)]">
          AI:{" "}
          {status ? (status.provider.available ? `${status.provider.label}` : "no model reachable — rules and templates are used") : "checking…"}
        </p>
      </section>

      <AtHome profile={profile} model={model} attempts={allAttempts} />

      <section id="sessions" className="panel flex scroll-mt-4 flex-col gap-4 p-6">
        <h2 className="font-display text-2xl font-bold">Session history</h2>
        <p className="text-sm text-[var(--ink-soft)]">Every puzzle, newest session first. Tap a session to open it.</p>
        {sessions.length === 0 && <p className="text-[var(--ink-soft)]">No sessions yet.</p>}
        {[...sessions].reverse().map((s, si) => (
          <details key={s.id} open={si === 0} className="rounded-2xl border-2 border-[var(--line)] p-4">
            <summary className="cursor-pointer font-semibold">
              {new Date(s.startedAt).toLocaleString()} · {s.attempts.filter((a) => a.correct).length} of {s.attempts.length} solved
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[15px]">
                <thead className="text-[var(--ink-soft)]">
                  <tr>
                    <th className="py-1 pr-3">#</th>
                    <th className="py-1 pr-3">Skill</th>
                    <th className="py-1 pr-3">Level</th>
                    <th className="py-1 pr-3">Result</th>
                    <th className="py-1 pr-3">What happened</th>
                    <th className="py-1">Chosen by</th>
                  </tr>
                </thead>
                <tbody>
                  {s.attempts.map((a, i) => (
                    <tr key={i} className="border-t border-[var(--line)]">
                      <td className="py-1.5 pr-3">{i + 1}</td>
                      <td className="py-1.5 pr-3">{SKILL_LABEL[a.skill]}</td>
                      <td className="py-1.5 pr-3">{a.level}</td>
                      <td className="py-1.5 pr-3">{a.correct ? (a.tries > 1 ? "solved on 2nd try" : "solved") : "shown the answer"}</td>
                      <td className="py-1.5 pr-3">
                        {a.mistake === "none" ? "—" : MISTAKE_TEXT[a.mistake]}
                        {a.hypothesis && (
                          <span className="mt-1 block rounded-lg bg-[#eef0ff] px-2 py-1 text-sm text-[#3e3f9a]">
                            <strong>A guess from the model:</strong> {a.hypothesis}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5">
                        {s.plans[i]?.source === "model" ? "model" : "rules"}
                        {s.plans[i]?.focus ? ` · ${s.plans[i].focus}` : ""}
                        {s.plans[i]?.source === "model" && s.plans[i]?.reason && (
                          <span className="block text-sm italic text-[var(--ink-soft)]">“{s.plans[i].reason}”</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary" onClick={exportJson}>Export as JSON</button>
        <ImportButton hasData />
        {confirmReset ? (
          <>
            <span className="text-[var(--ink-soft)]">This deletes the profile, friend and every session. It cannot be undone.</span>
            <button type="button" className="btn-danger" onClick={() => { resetLearn(); router.push("/"); }}>Delete everything</button>
            <button type="button" className="btn-secondary" onClick={() => setConfirmReset(false)}>Keep it</button>
          </>
        ) : (
          <button type="button" className="btn-secondary" onClick={() => setConfirmReset(true)}>Start over…</button>
        )}
        <Link href="/classic" className="ml-auto text-sm text-[var(--ink-soft)] hover:underline">Classic bead frame (v1)</Link>
      </section>
    </main>
  );
}

function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-[var(--ink-soft)]">{hint}</span>
      </span>
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`switch ${on ? "switch-on" : ""}`}>
        <span />
      </button>
    </label>
  );
}

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; title: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-semibold">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.id} type="button" aria-pressed={value === o.id} className={`chip ${value === o.id ? "chip-on" : ""}`} onClick={() => onChange(o.id)}>
            {o.title}
          </button>
        ))}
      </div>
    </div>
  );
}

function NotesSection({ notes, seen }: { notes: Note[]; seen: string[] }) {
  // Read means the grown-up said so: opening the page does not count.
  const markRead = (ids: string[]) => updateLearn({ seenNotes: [...new Set([...seen, ...ids])] });
  const unread = notes.filter((n) => !seen.includes(n.id));
  const read = notes.filter((n) => seen.includes(n.id));
  return (
    <section id="notes" className="panel flex flex-col gap-3 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
          Notes for you
          {unread.length > 0 && <span className="note-badge">{unread.length}</span>}
        </h2>
        {unread.length > 1 && (
          <button type="button" className="chip" onClick={() => markRead(unread.map((n) => n.id))}>
            Mark all as read
          </button>
        )}
      </div>
      {notes.length === 0 && (
        <p className="text-[var(--ink-soft)]">Nothing to flag. Notes appear here when something is worth a look — the same slip across sessions, slower answers, early breaks.</p>
      )}
      {notes.length > 0 && unread.length === 0 && <p className="text-[var(--ink-soft)]">No new notes. Earlier ones are below.</p>}
      <ul className="flex flex-col gap-3">
        {unread.map((n) => (
          <li key={n.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border-2 border-[#c9cdf5] bg-[#f7f8ff] p-4">
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-semibold">
                {n.title} <span className="badge badge-model">new</span>
              </p>
              <p className="text-[var(--ink-soft)]">{n.detail}</p>
              <NoteExtras n={n} />
            </div>
            <button type="button" className="btn-secondary min-h-0! px-4! py-1.5! text-base!" onClick={() => markRead([n.id])}>
              Got it
            </button>
          </li>
        ))}
      </ul>
      {read.length > 0 && (
        <details className="rounded-2xl border-2 border-[var(--line)] p-3">
          <summary className="cursor-pointer font-semibold text-[var(--ink-soft)]">Earlier notes ({read.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {read.map((n) => (
              <li key={n.id}>
                <p className="font-semibold">{n.title}</p>
                <p className="text-sm text-[var(--ink-soft)]">{n.detail}</p>
                <NoteExtras n={n} />
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="text-sm text-[var(--ink-soft)]">Observations about sessions, not an assessment.</p>
    </section>
  );
}

/**
 * Skills that work on the screen should work at the kitchen table too.
 * Mastered and strong skills first: those are ready to try with real things.
 */
function AtHome({ profile, model, attempts }: { profile: ChildProfile; model: LearnerModel; attempts: Attempt[] }) {
  const practised = [...new Set(attempts.map((a) => a.skill))];
  const ready = practised.filter((s) => isMastered(s, attempts) || model.strengths.includes(s));
  const rest = practised.filter((s) => !ready.includes(s));
  const skills = [...ready, ...rest].slice(0, 4);
  const who = profile.name || "your child";
  return (
    <section className="panel flex flex-col gap-4 p-6">
      <h2 className="font-display text-2xl font-bold">Try it at home</h2>
      <p className="text-[var(--ink-soft)]">
        The same maths, with real things. A skill {who} can use away from the screen is a skill {who} really has.
      </p>
      {skills.length === 0 ? (
        <p className="text-[var(--ink-soft)]">Ideas appear here after the first session.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {skills.map((s) => (
            <div key={s} className="rounded-2xl border-2 border-[var(--line)] p-4">
              <p className="font-display text-lg font-semibold">
                {SKILL_LABEL[s]}
                {ready.includes(s) && <span className="ml-2 badge badge-good">ready to try</span>}
              </p>
              <ul className="mt-1 list-disc pl-5 text-[var(--ink-soft)]">
                {AT_HOME[s].map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** The quote and the "see more" link a note may carry. */
function NoteExtras({ n }: { n: Note }) {
  return (
    <>
      {n.quote && <blockquote className="mt-2 rounded-lg bg-[#eef0ff] px-3 py-2 text-[#3e3f9a]">“{n.quote}”</blockquote>}
      {n.link && (
        <a href={n.link.href} className="mt-2 inline-block text-sm font-semibold text-[var(--accent-strong)] underline underline-offset-2">
          {n.link.label} →
        </a>
      )}
    </>
  );
}

/**
 * Bring back a Tally Tales export: a child's profile, friend and history,
 * e.g. moved from another device. It replaces what is on this device, so
 * it asks first when there is something to replace.
 */
function ImportButton({ hasData }: { hasData: boolean }) {
  const [msg, setMsg] = useState("");
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      const ok =
        d?.app === "tally-tales" && d.profile && typeof d.profile === "object" && d.character && typeof d.character === "object" && Array.isArray(d.sessions);
      if (!ok) return setMsg("That file is not a Tally Tales export.");
      if (hasData && !window.confirm("This replaces the child, friend and sessions on this device. Continue?")) return;
      updateLearn({ profile: d.profile, character: d.character, model: d.model ?? null, sessions: d.sessions, seenNotes: d.seenNotes ?? [] });
      setMsg(`Imported ${d.profile.name || "the child"}: ${d.sessions.length} session${d.sessions.length === 1 ? "" : "s"}.`);
    } catch {
      setMsg("That file could not be read.");
    }
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <label className="btn-secondary cursor-pointer">
        Import from JSON
        <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
      </label>
      {msg && <span className="text-sm text-[var(--ink-soft)]" role="status">{msg}</span>}
    </span>
  );
}
