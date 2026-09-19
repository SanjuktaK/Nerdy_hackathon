// ============================================================
// Notes for the grown-up: things worth a look, computed from the record.
// Observations about sessions, phrased as such — never a diagnosis, never
// shown to the child, and never used to choose the next puzzle.
// ============================================================

import { REP_LABEL, SKILL_LABEL, gradeInfo, nextGrade } from "./curriculum";
import { SIGN_TEXT } from "./overload";
import { isMastered } from "./policy";
import { MISTAKE_TEXT } from "./diagnose";
import type { Attempt, ChildProfile, Mistake, SessionRecord } from "./types";

export interface Note {
  /** Stable while the observation holds, so "seen" survives a reload. */
  id: string;
  title: string;
  detail: string;
  /** Words to show as a quote, e.g. the model's guess itself. */
  quote?: string;
  /** Where to see more, on the grown-ups page. */
  link?: { href: string; label: string };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

export function computeNotes(profile: ChildProfile, sessions: SessionRecord[], expected = 5): Note[] {
  const who = profile.name || "Your child";
  const notes: Note[] = [];
  const recent = sessions.slice(-5);
  const last = sessions[sessions.length - 1];

  // 1. The same slip across three sessions.
  // Ids name the observation, not a count, so a note read once stays read
  // while it still holds, and only a genuinely new event shows as new.
  const bySlip = new Map<Mistake, Set<string>>();
  for (const s of recent) {
    for (const a of s.attempts) {
      if (a.mistake === "none" || a.mistake === "guess") continue;
      bySlip.set(a.mistake, (bySlip.get(a.mistake) ?? new Set()).add(s.id));
    }
  }
  for (const [m, ids] of bySlip) {
    if (ids.size >= 3) {
      notes.push({
        id: `slip:${m}:${[...ids][0]}`,
        title: `The same slip in ${ids.size} sessions`,
        detail: `${who} ${MISTAKE_TEXT[m]} in ${ids.size} of the last ${recent.length} sessions. The app keeps giving easier steps for it; practising it together away from the screen may help too.`,
      });
    }
  }

  // 2. Answers getting slower.
  if (sessions.length >= 3 && last && last.attempts.length >= 3) {
    const before = sessions.slice(-3, -1).flatMap((s) => s.attempts.map((a) => a.ms));
    const now = median(last.attempts.map((a) => a.ms));
    const was = median(before);
    if (before.length >= 4 && was > 0 && now > was * 1.5) {
      notes.push({
        id: `slower:${last.id}`,
        title: "Answers took longer last time",
        detail: `In the last session ${who} took about ${Math.round((now / was - 1) * 100)}% longer per puzzle than in the two before. It may be tiredness, a new kind of puzzle, or the time of day.`,
      });
    }
  }

  // 3. Breaks asked for early.
  const lastThree = sessions.slice(-3);
  const early = lastThree.filter((s) => s.attempts.length < expected).length;
  if (lastThree.length >= 2 && early >= 2) {
    notes.push({
      id: `breaks:${[...lastThree].reverse().find((s) => s.attempts.length < expected)?.id}`,
      title: "Breaks asked for early",
      detail: `${who} pressed "I need a break" before the end in ${early} of the last ${lastThree.length} sessions. Shorter sessions (Settings → puzzles per session) might suit better for now.`,
    });
  }

  // 4. Comfortable with pictures, not yet with dots or numbers.
  const all: Attempt[] = sessions.flatMap((s) => s.attempts);
  const skills = [...new Set(all.map((a) => a.skill))];
  for (const sk of skills) {
    const as = all.filter((a) => a.skill === sk);
    const rate = (xs: Attempt[]) => (xs.length ? xs.filter((a) => a.correct && a.tries === 1).length / xs.length : 0);
    const pics = as.filter((a) => (a.rep ?? "C") === "C");
    for (const r of ["R", "A"] as const) {
      const other = as.filter((a) => a.rep === r);
      if (pics.length >= 3 && other.length >= 3 && rate(pics) >= 0.75 && rate(other) < 0.5) {
        notes.push({
          id: `rep:${sk}:${r}`,
          title: `${SKILL_LABEL[sk]}: ${REP_LABEL[r]} still new`,
          detail: `${who} is comfortable with ${SKILL_LABEL[sk].toLowerCase()} as pictures, and still finding it harder as ${REP_LABEL[r]}. The app will keep stepping between the two.`,
        });
      }
    }
  }

  // 5. An answer the rules could not explain: say which, and show the guess itself.
  const guesses = recent.flatMap((s) => s.attempts).filter((a) => a.hypothesis);
  if (guesses.length) {
    const g = guesses[guesses.length - 1];
    const unit = g.skill === "timeHour" ? " o'clock" : g.skill === "money" ? "¢" : g.skill === "measure" ? " cm" : "";
    const more = guesses.length - 1;
    notes.push({
      id: `guess:${g.questionId}`,
      title: `A guess about one of ${who}'s answers`,
      detail:
        `In a ${SKILL_LABEL[g.skill].toLowerCase()} puzzle, ${who} answered ${g.given}${unit} when the answer was ${g.expected}${unit}. ` +
        `The app's rules could not name the slip, so the on-device model made a guess. It is only a guess, and it never changes the puzzles.` +
        (more ? ` ${more} earlier guess${more === 1 ? " is" : "es are"} in the session history.` : ""),
      quote: g.hypothesis,
      link: { href: "/grown-ups#sessions", label: "See it in the session history" },
    });
  }

  // 6. Breaks offered because answers looked hard.
  const offered = recent.flatMap((s) => (s.offers ?? []).map((o) => ({ ...o, session: s.id })));
  if (offered.length) {
    const taken = offered.filter((o) => o.accepted).length;
    const signs = [...new Set(offered.map((o) => SIGN_TEXT[o.sign]))];
    notes.push({
      id: `offers:${offered[offered.length - 1].session}:${offered[offered.length - 1].at}`,
      title: `A break was offered ${offered.length} time${offered.length === 1 ? "" : "s"}`,
      detail: `The app noticed ${signs.join(" and ")} and offered ${who} a break. ${who} took ${taken} of them. This is from answers and taps only — no camera or microphone.`,
    });
  }

  // 7. Every skill in the school year finished: time to think about the next one.
  const band = gradeInfo(profile.grade);
  if (band.skills.length && band.skills.every((sk) => isMastered(sk, all))) {
    const next = nextGrade(profile.grade);
    notes.push({
      id: `ready:${profile.grade}`,
      title: next ? `Ready for ${next.label}` : "Everything in this demo is mastered",
      detail: next
        ? `${who} has finished every ${band.label} skill at the top level. You can move up to ${next.label} under “About ${who}”.`
        : `${who} has finished every skill up to 2nd grade. 3rd grade is coming next; until then the app keeps practising for review.`,
    });
  }

  return notes;
}
