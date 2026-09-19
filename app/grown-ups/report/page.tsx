"use client";

// ============================================================
// A one-page summary for a teacher, therapist or IEP meeting. Plain facts
// from this device's record, the goals the grown-up is working towards,
// and the supports in use. Prints cleanly; nothing is sent anywhere.
// ============================================================

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import { AT_HOME } from "@/lib/learn/athome";
import { REP_LABEL, REP_LADDER, SKILL_LABEL, gradeInfo } from "@/lib/learn/curriculum";
import { MISTAKE_TEXT } from "@/lib/learn/diagnose";
import { computeNotes } from "@/lib/learn/notes";
import { initialModel, isMastered } from "@/lib/learn/policy";
import { MONO_TONES, readAloudOf, sessionLengthOf } from "@/lib/learn/sensory";
import { getLearn, getLearnServer, subscribeLearn, updateLearn } from "@/lib/learn/store";
import type { Attempt, Mistake, SkillId } from "@/lib/learn/types";

const day = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export default function Report() {
  const state = useSyncExternalStore(subscribeLearn, getLearn, getLearnServer);
  const [prepared] = useState(() => Date.now());
  useEffect(() => {
    document.documentElement.style.fontSize = "100%";
  }, []);
  if (!state) return <main className="min-h-screen" aria-busy="true" />;
  const { profile, character, sessions } = state;
  if (!profile || !character) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p>Nothing is set up on this device yet.</p>
        <Link href="/" className="btn-primary mt-4">Start the setup</Link>
      </main>
    );
  }

  const model = state.model ?? initialModel(profile);
  const all: Attempt[] = sessions.flatMap((s) => s.attempts);
  const who = profile.name || "The child";
  const band = gradeInfo(profile.grade);
  const skills = [...new Set([...band.skills, ...all.map((a) => a.skill)])] as SkillId[];
  const notes = computeNotes(profile, sessions, sessionLengthOf(profile));
  const offers = sessions.flatMap((s) => s.offers ?? []);
  const setGoal = (s: SkillId, text: string) =>
    updateLearn({ profile: { ...profile, goals: { ...(profile.goals ?? {}), [s]: text.slice(0, 200) } } });

  const row = (s: SkillId) => {
    const as = all.filter((a) => a.skill === s);
    const first = as.filter((a) => a.correct && a.tries === 1).length;
    const slips = new Map<Mistake, number>();
    for (const a of as) if (a.mistake !== "none" && a.mistake !== "guess") slips.set(a.mistake, (slips.get(a.mistake) ?? 0) + 1);
    const topSlip = [...slips.entries()].sort((x, y) => y[1] - x[1])[0];
    const status = isMastered(s, all)
      ? "Mastered"
      : !as.length
        ? "Not started"
        : model.strengths.includes(s)
          ? "Strength"
          : model.workingOn.includes(s)
            ? "Working on"
            : "Practising";
    const rep = REP_LADDER[s] ? REP_LABEL[[...as].reverse().find((a) => a.rep)?.rep ?? "C"] : "—";
    return { s, as, first, topSlip, status, rep, level: model.levels[s] };
  };

  const supports = [
    profile.colourSensitive ? `One calm colour (${(MONO_TONES.find((t) => t.id === profile.monoTone) ?? MONO_TONES[0]).label.toLowerCase()})` : null,
    { auto: "Everything read aloud", tap: "Read aloud when tapped", off: "No voice" }[readAloudOf(profile)],
    profile.soundSensitive ? "Soft sounds" : null,
    profile.reduceMotion ? "No movement" : null,
    `${sessionLengthOf(profile)} puzzles, then a break`,
    "Picture schedule before each session",
    profile.showDemos !== false ? "Watch-first demo for new skills" : null,
    profile.overloadCheck === true
      ? `Break offered when things look hard${offers.length ? ` (${offers.length} offered, ${offers.filter((o) => o.accepted).length} taken)` : ""}`
      : null,
    profile.textSize && profile.textSize !== "normal" ? `${profile.textSize === "large" ? "Large" : "Extra large"} text` : null,
    profile.wideSpacing ? "Wider spacing" : null,
    profile.readableFont ? "Easy-to-read font" : null,
    profile.likesStories ? `Stories with ${character.name}${profile.favouriteShow ? ` (${profile.favouriteShow})` : ""}` : null,
  ].filter(Boolean) as string[];

  return (
    <main className="report mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/grown-ups" className="btn-secondary">← Grown-ups</Link>
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </div>

      <header className="flex flex-col gap-1 border-b-2 border-[var(--line)] pb-4">
        <p className="text-sm font-bold uppercase tracking-wide text-[var(--ink-soft)]">Tally Tales · progress summary</p>
        <h1 className="font-display text-4xl font-bold">{who}</h1>
        <p className="text-[var(--ink-soft)]">
          Age {profile.age} · {band.label} ·{" "}
          {sessions.length
            ? `${sessions.length} session${sessions.length === 1 ? "" : "s"}, ${day(sessions[0].startedAt)} – ${day(sessions[sessions.length - 1].endedAt)}`
            : "no sessions yet"}{" "}
          · {all.filter((a) => a.correct && a.tries === 1).length} of {all.length} puzzles right first time · prepared {day(prepared)}
        </p>
      </header>

      <section>
        <h2 className="report-h2">Summary</h2>
        <p className="text-lg">{model.note}</p>
      </section>

      <section>
        <h2 className="report-h2">Skills</h2>
        <table className="w-full text-left text-[15px]">
          <thead className="text-[var(--ink-soft)]">
            <tr>
              <th className="py-1 pr-3">Skill</th>
              <th className="py-1 pr-3">Level</th>
              <th className="py-1 pr-3">Status</th>
              <th className="py-1 pr-3">Right first time</th>
              <th className="py-1 pr-3">Shown as</th>
              <th className="py-1 pr-3">Most common slip</th>
              <th className="py-1">Goal</th>
            </tr>
          </thead>
          <tbody>
            {skills.map(row).map((r) => (
              <tr key={r.s} className="border-t border-[var(--line)] align-top">
                <td className="py-2 pr-3 font-semibold">{SKILL_LABEL[r.s]}</td>
                <td className="py-2 pr-3">{r.as.length && r.level ? `${r.level} / 5` : "—"}</td>
                <td className="py-2 pr-3">{r.status}</td>
                <td className="py-2 pr-3">{r.as.length ? `${r.first} of ${r.as.length}` : "—"}</td>
                <td className="py-2 pr-3">{r.rep}</td>
                <td className="py-2 pr-3">{r.topSlip ? `${MISTAKE_TEXT[r.topSlip[0]]} (${r.topSlip[1]}×)` : "—"}</td>
                <td className="py-2">
                  <input
                    className="field no-print min-h-0! w-full py-1! text-sm!"
                    placeholder="e.g. Adds within 20 with 80% accuracy"
                    value={profile.goals?.[r.s] ?? ""}
                    onChange={(e) => setGoal(r.s, e.target.value)}
                    aria-label={`Goal for ${SKILL_LABEL[r.s]}`}
                  />
                  <span className="print-only">{profile.goals?.[r.s] || "—"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Level 5 is the top of each skill for this school year. Mastered = 3 answers right first time at level 5. “Shown as” is the
          most recent way the puzzle was drawn: pictures, dots, or numbers only.
        </p>
      </section>

      {notes.length > 0 && (
        <section>
          <h2 className="report-h2">Worth a look</h2>
          <ul className="flex flex-col gap-2">
            {notes.map((n) => (
              <li key={n.id}>
                <strong>{n.title}.</strong> {n.detail}
                {n.quote && <em> “{n.quote}”</em>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="report-h2">Supports in use</h2>
        <ul className="grid list-disc gap-x-8 gap-y-1 pl-5 sm:grid-cols-2">
          {supports.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>

      {skills.some((s) => all.some((a) => a.skill === s)) && (
        <section>
          <h2 className="report-h2">Try it away from the screen</h2>
          <ul className="flex flex-col gap-1">
            {skills
              .filter((s) => all.some((a) => a.skill === s))
              .slice(0, 4)
              .map((s) => (
                <li key={s}>
                  <strong>{SKILL_LABEL[s]}:</strong> {AT_HOME[s][0]}
                </li>
              ))}
          </ul>
        </section>
      )}

      <footer className="border-t-2 border-[var(--line)] pt-3 text-sm text-[var(--ink-soft)]">
        A learning tool, not an assessment or a diagnosis. Prepared on this device from its own record; nothing was sent anywhere.{" "}
        {profile.adaptConsent
          ? "Next puzzles were chosen by an on-device AI model within fixed safety rules."
          : "Adapting was switched off: puzzles came in a fixed order at a fixed level."}
      </footer>
    </main>
  );
}
