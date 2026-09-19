"use client";

// ============================================================
// One session: five questions, then a break.
//
//   planning → (demo, first time a skill appears) → play
//     right             → cheer → next
//     wrong, first try  → a calm hint, one more try
//     wrong, second try → show the answer calmly → next
//   after five          → break, and the session goes to the model for review
//
// The model plans every question from the answers so far. When it is slow
// or missing, the same rules it is fenced by plan instead, in the browser.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";

import { SKILL_LABEL } from "@/lib/learn/curriculum";
import { diagnose } from "@/lib/learn/diagnose";
import { generateQuestion } from "@/lib/learn/generate";
import { rulePlan } from "@/lib/learn/policy";
import type { Note } from "@/lib/learn/notes";
import { OFFER_COOLDOWN, OFFER_LINE, RUSHED_MS, franticTapping, missedTwice, type OverloadSign } from "@/lib/learn/overload";
import { readAloudOf, sessionLengthOf } from "@/lib/learn/sensory";
import { speak, stopSpeaking } from "@/lib/learn/sound";
import type {
  Attempt,
  Character,
  ChildProfile,
  LearnerModel,
  Mistake,
  Plan,
  Question,
  SessionRecord,
  SkillId,
} from "@/lib/learn/types";
import { worldOf } from "@/lib/learn/worlds";

import { Buddy, CharacterArt, type Mood } from "./Character";
import { Cheer } from "./Cheer";
import { GrownUpsLink } from "./GrownUpsLink";
import { Jar } from "./Items";
import { DemoPlayer, QuestionCard } from "./Question";

/** Event handlers read the clock through this, so it is plainly not part of drawing. */
const clock = () => Date.now();

type Phase = "preview" | "pause" | "planning" | "demo" | "play" | "retry" | "cheer" | "reveal" | "break";

const HINTS: Record<Mistake, (q: Question) => string> = {
  none: () => "",
  "off-by-one": () => "Count again, slowly. Touch each one once.",
  "wrong-operation": (q) =>
    q.ask.includes("left") ? "Some go away, so the number gets smaller." : "More are coming, so the number gets bigger.",
  "digits-swapped": () => "Tens go on the tens rod. Ones go on the ones rod.",
  regrouping: () => "Ten ones make one ten. Look at the ones first.",
  "chose-opposite": (q) => (q.ask.includes("more") ? "More means the bigger pile." : "Fewer means the smaller pile."),
  "place-value": () => "Check each rod: hundreds, tens, then ones.",
  guess: () => "Look again. Take your time.",
};

interface PlanResponse {
  plan: Plan;
  story?: string;
  provider: string;
  latencyMs: number;
}

export function Session({
  profile,
  character,
  model,
  previous,
  totalSaved,
  onFinish,
  onHome,
  notes,
  seenNotes,
  onHypothesis,
}: {
  profile: ChildProfile;
  character: Character;
  model: LearnerModel;
  previous: Attempt[];
  totalSaved: number;
  onFinish: (record: SessionRecord, reviewed: Promise<LearnerModel>) => void;
  onHome: () => void;
  notes: Note[];
  seenNotes: string[];
  /** A guess arrived for an answer after the session was saved. */
  onHypothesis: (questionId: string, text: string) => void;
}) {
  const total = sessionLengthOf(profile);
  // The running total as it was when this session began: once the session is
  // saved, the parent's total already includes it, and adding it twice doubled the count.
  const [savedBefore] = useState(totalSaved);
  const world = worldOf(character);
  const hero = character.name;
  const [sessionId] = useState(() => `s${Date.now().toString(36)}`);
  const [startedAt] = useState(() => Date.now());
  const pace = profile.support === "lots" ? 1.35 : profile.support === "some" ? 1.1 : 0.9;
  // Voice: "auto" reads everything, "tap" only the speaker button, "off" nothing.
  const voiceMode = readAloudOf(profile);
  const readAloud = voiceMode === "auto";
  const quiet = profile.soundSensitive;

  const [phase, setPhase] = useState<Phase>("preview");
  const [premise, setPremise] = useState<string | null | undefined>(profile.likesStories ? undefined : null);
  const [q, setQ] = useState<Question | null>(null);
  const [demoQ, setDemoQ] = useState<Question | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [plans, setPlans] = useState<(Plan & { provider: string; latencyMs: number; story: boolean })[]>([]);
  const [tried, setTried] = useState<string[]>([]);
  const [firstMistake, setFirstMistake] = useState<Mistake>("none");
  const [bubble, setBubble] = useState(character.catchphrase);
  const demoed = useRef(new Set<SkillId>());
  const pausedFrom = useRef<Phase>("play");
  const saved = useRef(false);
  const hypotheses = useRef(new Map<string, string>());
  // Signs that things are getting hard, and the gentle break offers they led to.
  const [offer, setOffer] = useState<OverloadSign | null>(null);
  const offers = useRef<NonNullable<SessionRecord["offers"]>>([]);
  const tapTimes = useRef<number[]>([]);
  const rushed = useRef(0);
  const lastOfferAt = useRef(-Infinity);
  const shownAt = useRef(0);

  const say = useCallback(
    (text: string) => {
      setBubble(text);
      if (readAloud) speak(text, { quiet });
    },
    [readAloud, quiet]
  );

  // ---------- planning ----------

  const planNext = useCallback(
    async (history: Attempt[]) => {
      setPhase("planning");
      setTried([]);
      setFirstMistake("none");
      setBubble(`${hero} is getting the next puzzle ready.`);
      const index = history.length;
      const seed = `${sessionId}-${index}`;
      const t0 = Date.now();

      let res: PlanResponse;
      try {
        const r = await fetch("/api/learn/plan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ profile, model, hero, seed, world, premise, history: [...previous.slice(-40), ...history] }),
        });
        if (!r.ok) throw new Error(String(r.status));
        res = (await r.json()) as PlanResponse;
      } catch {
        res = { plan: rulePlan(profile, model, [...previous.slice(-40), ...history]), provider: "rules (offline)", latencyMs: 0 };
      }

      const next = generateQuestion({
        skill: res.plan.skill,
        level: res.plan.level,
        seed,
        world,
        hero,
        story: profile.likesStories ? res.story : undefined,
        rep: res.plan.rep ?? model.reps?.[res.plan.skill] ?? "C",
      });
      const needsDemo = profile.showDemos !== false && !demoed.current.has(next.skill);
      // Start reading the puzzle now, during the pause, so its first word
      // lands as it appears. (With a demo first, it is read after the demo.)
      if (readAloud && !needsDemo) {
        speak(`${index === total - 1 ? "Last puzzle. " : ""}${next.story} ${next.ask}`, { quiet });
      }

      // A short, steady pause even when the model is fast: the rhythm is part of the calm.
      const wait = Math.max(0, 900 - (Date.now() - t0));
      await new Promise((r) => setTimeout(r, wait));

      setPlans((p) => [...p, { ...res.plan, provider: res.provider, latencyMs: res.latencyMs, story: !!res.story }]);
      setQ(next);
      shownAt.current = Date.now();

      const lastOne = index === total - 1;
      if (needsDemo) {
        demoed.current.add(next.skill);
        // The demo is an easier question with a different answer, so watching
        // it never hands the child the answer to their own turn.
        let demo = next;
        for (let k = 0; k < 8 && demo.answer === next.answer; k++) {
          demo = generateQuestion({
            skill: next.skill,
            level: Math.max(1, next.level - 1) as Question["level"],
            seed: `${seed}-demo${k}`,
            world,
            hero,
          });
        }
        setDemoQ(demo);
        setBubble(`Watch me first.`);
        setPhase("demo");
      } else {
        setPhase("play");
        // A calm warning before the end, so the break is never a surprise.
        setBubble(lastOne ? "Last puzzle. Then a break." : "Your turn.");
      }
    },
    [hero, model, previous, premise, profile, quiet, readAloud, sessionId, total, world]
  );

  // While the schedule is on screen, the model writes the opening of today's story.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !profile.likesStories) return;
    started.current = true;
    fetch("/api/learn/premise", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile, hero, world }),
    })
      .then((r) => r.json())
      .then((b: { premise?: string | null }) => setPremise(b.premise ?? null))
      .catch(() => setPremise(null));
  }, [hero, profile, world]);
  useEffect(() => () => stopSpeaking(), []);

  // The end of a full set is said once, after the cheer (the queue waits for it).
  const endRead = useRef(false);
  useEffect(() => {
    if (phase !== "break" || !readAloud || endRead.current || attempts.length !== total) return;
    endRead.current = true;
    speak(`You finished all ${total} puzzles. Now it is time to rest.`, { quiet });
  }, [phase, readAloud, attempts.length, total, quiet]);

  // The schedule is read out when it appears — with today's story opening
  // once the model has written it — not when the child presses "Let's go".
  const scheduleRead = useRef(false);
  useEffect(() => {
    if (phase !== "preview" || !readAloud || scheduleRead.current || premise === undefined) return;
    scheduleRead.current = true;
    speak(`Today with ${hero}. ${premise ? `${premise} ` : ""}First, ${total} puzzles. Then, a break.`, { quiet });
  }, [phase, readAloud, premise, hero, total, quiet]);

  // ---------- answering ----------

  const record = (correct: boolean, given: string, mistake: Mistake): Attempt[] => {
    const a: Attempt = {
      questionId: q!.id,
      skill: q!.skill,
      level: q!.level,
      correct,
      given,
      expected: q!.answer,
      mistake,
      tries: tried.length + 1,
      rep: q!.rep,
      ms: Date.now() - shownAt.current,
      at: Date.now(),
    };
    const next = [...attempts, a];
    setAttempts(next);
    return next;
  };

  const maybeOffer = (sign: OverloadSign, answered: number) => {
    if (profile.overloadCheck !== true || offer) return;
    if (answered - lastOfferAt.current < OFFER_COOLDOWN) return;
    lastOfferAt.current = answered;
    setOffer(sign);
    say(OFFER_LINE[sign]);
  };

  const closeOffer = (accepted: boolean) => {
    if (!offer) return;
    offers.current.push({ sign: offer, accepted, at: clock() });
    setOffer(null);
    if (accepted) takeBreak();
    else setBubble("Okay. We keep going, slowly.");
  };

  const answer = (given: string) => {
    if (!q) return;
    if (given !== q.answer && clock() - shownAt.current < RUSHED_MS) {
      rushed.current += 1;
      if (rushed.current >= 2) maybeOffer("rushing", attempts.length);
    }
    if (given === q.answer) {
      record(true, given, firstMistake);
      setPhase("cheer");
      return;
    }
    const m = diagnose(q, given);
    if (tried.length === 0) {
      setTried([given]);
      setFirstMistake(m);
      setPhase("retry");
      say(HINTS[m](q));
      return;
    }
    const mistake = firstMistake === "none" ? m : firstMistake;
    const done = record(false, given, mistake);
    if (missedTwice(done)) maybeOffer("misses", done.length);
    if (mistake === "guess" && profile.adaptConsent) askForGuess(q, given);
    setPhase("reveal");
    say(`The answer is ${q.mode === "choices" ? q.choices.find((c) => c.id === q.answer)?.label ?? q.answer : q.answer}.`);
  };

  /**
   * An answer the rules cannot explain goes to the model for a guess. It is
   * for the grown-up only, labelled as a guess, and never picks a puzzle.
   */
  const askForGuess = (question: Question, given: string) => {
    fetch("/api/learn/hypothesis", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question, given }),
    })
      .then((r) => r.json())
      .then((b: { hypothesis?: string | null }) => {
        if (!b.hypothesis) return;
        if (saved.current) onHypothesis(question.id, b.hypothesis);
        else hypotheses.current.set(question.id, b.hypothesis);
      })
      .catch(() => undefined);
  };

  const finish = (done: Attempt[]) => {
    stopSpeaking();
    setPhase("break");
    setBubble(`${hero} is having a rest too.`);
    if (!done.length) return;
    saved.current = true;
    const withGuesses = done.map((a) => (hypotheses.current.has(a.questionId) ? { ...a, hypothesis: hypotheses.current.get(a.questionId) } : a));
    const rec: SessionRecord = {
      id: sessionId,
      startedAt,
      endedAt: Date.now(),
      attempts: withGuesses,
      plans: plans.slice(0, done.length),
      offers: offers.current,
    };
    const reviewed = fetch("/api/learn/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile, model, attempts: done }),
    })
      .then((r) => r.json())
      .then((b: { model: LearnerModel }) => b.model);
    onFinish(rec, reviewed);
  };

  const next = () => {
    if (attempts.length >= total) return finish(attempts);
    void planNext(attempts);
  };

  /**
   * The child can stop whenever they need to. A break is a pause, not an
   * ending: breathe with the friend, then come back or be all done.
   */
  const takeBreak = () => {
    stopSpeaking();
    pausedFrom.current = phase;
    setPhase("pause");
    setBubble(`${hero} is taking a break with you.`);
  };
  const resume = () => {
    setPhase(pausedFrom.current === "pause" ? "play" : pausedFrom.current);
    setBubble("Welcome back.");
  };

  // ---------- render ----------

  const solved = attempts.filter((a) => a.correct).length;
  const mood: Mood =
    phase === "planning" ? "thinking" : phase === "break" ? "sleepy" : phase === "cheer" ? "happy" : "calm";
  const lastPlan = plans[plans.length - 1];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 pb-8 pt-3 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <GrownUpsLink notes={notes} seen={seenNotes} />
        <ol className="flex items-center gap-2" aria-label={`Puzzle ${Math.min(attempts.length + 1, 5)} of ${total}`}>
          {Array.from({ length: total }).map((_, i) => {
            const a = attempts[i];
            const current = i === attempts.length && phase !== "break";
            return (
              <li
                key={i}
                className={`stone ${a ? "stone-done" : ""} ${current ? "stone-now" : ""}`}
                aria-label={a ? "done" : current ? "now" : "to come"}
              />
            );
          })}
        </ol>
        {phase !== "break" && phase !== "pause" ? (
          <button type="button" onClick={takeBreak} className="break-btn" aria-label="I need a break">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" /></svg>
            I need a break
          </button>
        ) : (
          <span className="w-16" />
        )}
      </header>

      <div className="grid flex-1 gap-5 lg:grid-cols-[300px_1fr]">
        <aside className="panel flex flex-row items-center gap-4 lg:flex-col lg:justify-start lg:pt-8">
          <div className="relative flex flex-col items-center">
            <Buddy
              character={character}
              mood={mood}
              size={150}
              interactive={phase !== "demo"}
              onSay={(line) => {
                setBubble(line);
                if (readAloud) speak(line, { quiet, interrupt: true });
              }}
            />
            <p className="font-display text-xl font-bold">{hero}</p>
          </div>
          <div className="flex flex-1 flex-col items-center gap-4">
            <p className="bubble" aria-live="polite">{bubble}</p>
            <Jar world={world} filled={solved} of={total} total={savedBefore + solved} label={world.jar} size={92} />
          </div>
        </aside>

        <main
          className="panel relative flex flex-col items-center justify-center gap-4 p-5 sm:p-8"
          onPointerDownCapture={() => {
            const now = Date.now();
            tapTimes.current = [...tapTimes.current.filter((t) => now - t < 3000), now];
            if (franticTapping(tapTimes.current, now)) maybeOffer("tapping", attempts.length);
          }}
        >
          {offer && (
            <div className="offer-card" role="dialog" aria-label="Would you like a break?">
              <CharacterArt character={character} mood="calm" size={70} />
              <p className="font-display text-2xl font-semibold">{OFFER_LINE[offer]}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button type="button" className="btn-primary" onClick={() => closeOffer(true)} autoFocus>
                  Yes, a break
                </button>
                <button type="button" className="btn-secondary" onClick={() => closeOffer(false)}>
                  Keep going
                </button>
              </div>
            </div>
          )}
          {phase === "preview" && (
            <div className="flex w-full flex-col items-center gap-6 py-4 text-center">
              <p className="font-display text-3xl font-bold">Today with {hero}</p>
              {profile.likesStories && (
                <p className="min-h-[2.5rem] max-w-xl font-display text-2xl text-[var(--ink-soft)]" aria-live="polite">
                  {premise === undefined ? "…" : premise ?? `${hero} has some ${world.item.many} to count.`}
                </p>
              )}
              {/* A picture schedule: what happens, in order, before it happens. */}
              <ol className="schedule" aria-label={`First ${total} puzzles, then a break`}>
                <li className="schedule-step">
                  <span className="schedule-label">First</span>
                  <span className="flex gap-1.5">
                    {Array.from({ length: total }).map((_, i) => (
                      <span key={i} className="stone" aria-hidden="true" />
                    ))}
                  </span>
                  <span className="font-display text-xl">{total} puzzles</span>
                </li>
                <li className="schedule-arrow" aria-hidden="true">→</li>
                <li className="schedule-step">
                  <span className="schedule-label">Then</span>
                  <CharacterArt character={character} mood="sleepy" size={54} />
                  <span className="font-display text-xl">a break</span>
                </li>
              </ol>
              <button
                type="button"
                className="btn-primary btn-xl"
                autoFocus
                onClick={() => void planNext([])}
              >
                Let’s go
              </button>
            </div>
          )}

          {phase === "pause" && (
            <div className="flex flex-col items-center gap-5 py-6 text-center">
              <p className="font-display text-3xl font-bold">Break time.</p>
              {/* A slow breathing guide: in for four, out for four. */}
              <div className="breathe" aria-hidden="true">
                <CharacterArt character={character} mood="sleepy" size={120} />
              </div>
              <p className="breathe-words font-display text-2xl text-[var(--ink-soft)]" aria-live="polite">
                <span className="breathe-in">Breathe in…</span>
                <span className="breathe-out">Breathe out…</span>
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button type="button" className="btn-primary" onClick={resume}>
                  Back to puzzles
                </button>
                <button type="button" className="btn-secondary" onClick={() => finish(attempts)}>
                  All done for today
                </button>
              </div>
            </div>
          )}

          {phase === "planning" && (
            <div className="flex flex-col items-center gap-4 py-16" role="status">
              <div className="thinking-dots" aria-hidden="true"><span /><span /><span /></div>
              <p className="font-display text-2xl text-[var(--ink-soft)]">Getting the next puzzle ready…</p>
            </div>
          )}

          {phase === "demo" && demoQ && (
            <DemoPlayer
              q={demoQ}
              world={world}
              hero={hero}
              items={world.item.many}
              pace={pace}
              onSay={readAloud ? say : setBubble}
              onDone={() => {
                setPhase("play");
                const lastOne = attempts.length === total - 1;
                setBubble(lastOne ? "Last puzzle. Then a break." : "Your turn.");
                shownAt.current = Date.now();
                if (readAloud && q) speak(`${q.story} ${q.ask}`, { quiet });
              }}
            />
          )}

          {(phase === "play" || phase === "retry" || phase === "reveal") && q && (
            <>
              <QuestionCard
                key={q.id + (phase === "reveal" ? "-r" : "")}
                q={q}
                world={world}
                interactive={phase !== "reveal"}
                tried={tried}
                state={phase === "reveal" ? { selected: q.answer, abacus: q.mode === "abacus" ? Number(q.answer) : undefined, annot: { worked: 9 } } : undefined}
                onAnswer={answer}
                onSpeak={voiceMode === "off" ? undefined : (t) => speak(t, { quiet, interrupt: true })}
                onCount={readAloud ? (n) => speak(String(n), { quiet, rate: 1, interrupt: true }) : undefined}
              />
              {phase === "retry" && <p className="hint" role="status">{HINTS[firstMistake](q)}</p>}
              {phase === "reveal" && (
                <div className="flex flex-col items-center gap-3">
                  <p className="hint" role="status">That one was tricky. {hero} will pick one that fits better.</p>
                  <button type="button" className="btn-primary" onClick={next} autoFocus>
                    Next
                  </button>
                </div>
              )}
            </>
          )}

          {phase === "cheer" && (
            <div className="flex w-full flex-col items-center gap-2">
              <Cheer style={profile.cheer} character={character} soundSensitive={profile.soundSensitive} voiceOn={voiceMode !== "off"} line={`${hero} adds to the ${world.jar}.`} />
              <button type="button" className="btn-primary" onClick={next} autoFocus>
                {attempts.length >= total ? "Finish" : "Next"}
              </button>
            </div>
          )}

          {phase === "break" && (
            <div className="flex w-full flex-col items-center gap-4 py-6 text-center">
              {/* Finishing the whole set is celebrated, in the cheer style the grown-up
                  chose — for finishing, not for a score. Stopping early is not. */}
              {attempts.length === total ? (
                <Cheer
                  style={profile.cheer}
                  character={character}
                  soundSensitive={profile.soundSensitive}
                  voiceOn={voiceMode !== "off"}
                  line={`You finished all ${total} puzzles.`}
                />
              ) : null}
              <p className="font-display text-4xl font-bold">Break time.</p>
              <p className="max-w-md text-xl text-[var(--ink-soft)]">
                {attempts.length === total ? `All ${total} puzzles are done.` : attempts.length ? `${attempts.length} puzzle${attempts.length === 1 ? " is" : "s are"} done.` : "Rest first."}{" "}
                {solved > 0 ? `${hero} saved ${solved} in the ${world.jar}.` : ""} Now it is time to rest.
              </p>
              <Jar world={world} filled={solved} of={total} total={savedBefore + solved} label={world.jar} size={140} />
              <button type="button" className="btn-primary" onClick={onHome} autoFocus>
                Back home
              </button>
            </div>
          )}
        </main>
      </div>

      {lastPlan && phase !== "break" && (
        <footer className="ai-note" aria-label="Why this puzzle">
          <span className={`src-dot ${lastPlan.source === "model" ? "src-model" : ""}`} aria-hidden="true" />
          <span>
            {SKILL_LABEL[lastPlan.skill]} · level {lastPlan.level} · focus: {lastPlan.focus}
          </span>
          {lastPlan.source === "model" && <span className="italic">“{lastPlan.reason}”</span>}
          <span className="opacity-70">
            {lastPlan.source === "model"
              ? `planned by on-device model (${lastPlan.provider}, ${lastPlan.latencyMs} ms)`
              : profile.adaptConsent
                ? "planned by rules (model unavailable or out of bounds)"
                : "fixed order (adapting is off)"}
            {lastPlan.story ? " · story by model" : " · story from template"}
          </span>
        </footer>
      )}
    </div>
  );
}
