"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { CharacterArt } from "@/components/learn/Character";
import { CHEER_OPTIONS, playCheerSound } from "@/components/learn/Cheer";
import { FriendEditor } from "@/components/learn/FriendEditor";
import { ReadAloudPicker, TonePicker, VolumeSlider } from "@/components/learn/SettingsPickers";
import { setEffects, setVoiceStyle, speak } from "@/lib/learn/sound";
import { VOICE_OPTIONS, readAloudOf, sensoryFilter, sessionLengthOf, soundSettings, voiceStyleOf } from "@/lib/learn/sensory";
import { computeNotes, type Note } from "@/lib/learn/notes";
import { GRADES, SKILL_LABEL, gradeInfo } from "@/lib/learn/curriculum";
import { MISTAKE_TEXT } from "@/lib/learn/diagnose";
import { initialModel } from "@/lib/learn/policy";
import { getLearn, getLearnServer, resetLearn, subscribeLearn, updateLearn } from "@/lib/learn/store";
import type { ChildProfile, SessionRecord, SkillId } from "@/lib/learn/types";
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
  useEffect(() => {
    if (prof && ch) setVoiceStyle(voiceStyleOf(prof, worldOf(ch).body));
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
        <Link href="/" className="btn-primary">Start the setup</Link>
      </main>
    );
  }

  const model = state.model ?? initialModel(profile);
  const notes = computeNotes(profile, sessions, sessionLengthOf(profile));
  const setP = (patch: Partial<ChildProfile>) => updateLearn({ profile: { ...profile, ...patch } });
  const who = profile.name || "Your child";
  const allAttempts = sessions.flatMap((s) => s.attempts);
  const right = allAttempts.filter((a) => a.correct).length;
  const skills = Object.keys(model.levels) as SkillId[];

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
          <h1 className="font-display text-4xl font-bold">Grown-ups</h1>
          <p className="text-[var(--ink-soft)]">Everything here is stored on this device only.</p>
        </div>
        <Link href="/" className="btn-secondary">Back to {character.name}</Link>
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
                  {model.strengths.includes(s) && <span className="ml-2 badge badge-good">strength</span>}
                  {model.workingOn.includes(s) && <span className="ml-2 badge">working on</span>}
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
            {model.sessions} session{model.sessions === 1 ? "" : "s"} so far. A learning tool, not an assessment.
          </p>
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
          <span className="font-semibold">{character.name}’s voice</span>
          <div className="grid gap-3 sm:grid-cols-3">
            {VOICE_OPTIONS.map((v) => {
              const on = voiceStyleOf(profile, worldOf(character).body) === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={on}
                  className={`option ${on ? "option-on" : ""}`}
                  onClick={() => {
                    setP({ voiceStyle: v.id });
                    setVoiceStyle(v.id);
                    void speak(`Hello, I am ${character.name}. Let us count together.`);
                  }}
                >
                  <span className="font-display text-lg font-bold">{v.title}</span>
                  <span className="text-[15px] leading-snug text-[var(--ink-soft)]">{v.blurb} Tap to hear it.</span>
                </button>
              );
            })}
          </div>
        </div>
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

      <AiHealth sessions={sessions} />

      <section className="panel flex flex-col gap-4 p-6">
        <h2 className="font-display text-2xl font-bold">Sessions</h2>
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
  // Opening this page is reading the notes: they stop counting as new.
  useEffect(() => {
    const ids = notes.map((n) => n.id);
    if (ids.some((id) => !seen.includes(id))) updateLearn({ seenNotes: [...new Set([...seen, ...ids])] });
  }, [notes, seen]);
  return (
    <section id="notes" className="panel flex flex-col gap-3 p-6">
      <h2 className="font-display text-2xl font-bold">Notes for you</h2>
      {notes.length === 0 ? (
        <p className="text-[var(--ink-soft)]">Nothing to flag. Notes appear here when something is worth a look — the same slip across sessions, slower answers, early breaks.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-2xl border-2 border-[var(--line)] p-4">
              <p className="font-display text-lg font-semibold">
                {n.title}
                {!seen.includes(n.id) && <span className="ml-2 badge badge-model">new</span>}
              </p>
              <p className="text-[var(--ink-soft)]">{n.detail}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-[var(--ink-soft)]">Observations about sessions, not an assessment.</p>
    </section>
  );
}

interface Check {
  job: string;
  ok: boolean;
  ms: number;
  sample: string;
}

/**
 * "Is Qwen working?" Two answers: what it has actually done in this child's
 * sessions, and a live check of every job it does.
 */
function AiHealth({ sessions }: { sessions: SessionRecord[] }) {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [running, setRunning] = useState(false);
  const plans = sessions.flatMap((s) => s.plans ?? []);
  const byModel = plans.filter((p) => p.source === "model").length;
  const stories = plans.filter((p) => (p as { story?: boolean }).story).length;
  const run = async () => {
    setRunning(true);
    setChecks(null);
    try {
      const r = await fetch("/api/learn/health", { method: "POST" });
      setChecks(((await r.json()) as { checks: Check[] }).checks);
    } catch {
      setChecks([]);
    } finally {
      setRunning(false);
    }
  };
  return (
    <section className="panel flex flex-col gap-4 p-6">
      <h2 className="font-display text-2xl font-bold">Is the AI working?</h2>
      {plans.length > 0 && (
        <p className="text-[var(--ink-soft)]">
          In {sessions.length} session{sessions.length === 1 ? "" : "s"}: {byModel} of {plans.length} puzzles were chosen by the on-device model and {stories} had a story it wrote. The rest used the app’s rules and templates.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary" onClick={run} disabled={running}>
          {running ? "Checking… (about 10 seconds)" : "Run a check"}
        </button>
        <span className="text-sm text-[var(--ink-soft)]">Runs every job once on a made-up child and shows what came back.</span>
      </div>
      {checks && (
        <ul className="flex flex-col gap-2">
          {checks.length === 0 && <li className="text-[var(--ink-soft)]">The check could not reach the app’s server.</li>}
          {checks.map((c) => (
            <li key={c.job} className="flex flex-col gap-0.5 rounded-xl border-2 border-[var(--line)] px-3 py-2">
              <span className="flex items-center gap-2 font-semibold">
                <span className={`h-3 w-3 rounded-full ${c.ok ? "bg-[#4f9b5a]" : "bg-[#d08a2e]"}`} aria-hidden="true" />
                {c.job}
                <span className="text-sm font-normal text-[var(--ink-soft)]">
                  {c.ok ? "by the model" : "fell back to rules or template"} · {(c.ms / 1000).toFixed(1)} s
                </span>
              </span>
              {c.sample && <span className="text-sm italic text-[var(--ink-soft)]">{c.sample}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
