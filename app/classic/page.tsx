"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import { Shell } from "@/components/child/Shell";
import {
  BreakCard,
  DoneCard,
  FeedbackCard,
  GuidedCard,
  IndependentCard,
  ModelCard,
  PreviewCard,
} from "@/components/child/Phases";
import { useSession } from "@/lib/session/useSession";
import { previewText } from "@/lib/session/machine";
import { getSkill } from "@/lib/skills/registry";
import { rendererFor } from "@/lib/skills/types";
import {
  getProfileServerSnapshot,
  getProfileSnapshot,
  newProfile,
  saveProfile,
  subscribeProfile,
  type Profile,
} from "@/lib/persistence/store";
import { languageLoad } from "@/lib/policy/profile";
import { countWords } from "@/lib/ai/validate";

export default function ChildApp() {
  const profile = useSyncExternalStore(
    subscribeProfile,
    getProfileSnapshot,
    getProfileServerSnapshot
  );

  // First run with no caregiver setup: write a default profile, so a child
  // is never blocked by an adult-facing form. Writing to the store — not to
  // component state — is what makes this a legitimate effect.
  useEffect(() => {
    if (!getProfileSnapshot()) saveProfile(newProfile(""));
  }, []);

  if (!profile) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <p className="text-xl text-[var(--ink-soft)]">Loading the profile on this device.</p>
      </main>
    );
  }

  return <Session profile={profile} />;
}

function Session({ profile }: { profile: Profile }) {
  const s = useSession(profile);
  const { state } = s;
  const theme = profile.theme;

  const skill = getSkill(state.cursor.skillId);
  const Renderer = useMemo(
    () => rendererFor(skill, state.cursor.representation),
    [skill, state.cursor.representation]
  );

  // Surface D (§9.4): the correction is rewritten to the word ceiling the
  // child's own profile supports. The original is always the fallback, so
  // a slow or missing model costs nothing here.
  const ll = useMemo(
    () => languageLoad(s.events, (ev) => (ev.taskId === state.task?.id ? s.stemWords : 10)),
    [s.events, s.stemWords, state.task?.id]
  );
  const rawMessage =
    (skill.childMessage as Record<string, string>)[
      state.independentCode ?? state.guidedCode ?? "CORRECT"
    ] ?? "";
  const message = useAdaptedLanguage(rawMessage, ll.maxWords);

  const answerable = state.task ? skill.isAnswerable(state.work, state.task) : false;
  const code = state.independentCode ?? state.guidedCode;

  return (
    <Shell theme={theme} phase={state.phase} index={state.index} total={s.total}>
      {state.phase === "PREVIEW" && (
        <PreviewCard
          text={previewText(state)}
          theme={theme}
          loading={state.loading || !state.task}
          onStart={s.startTasks}
        />
      )}

      {state.phase === "MODEL" && state.task && (
        <ModelCard
          task={state.task}
          theme={theme}
          steps={skill.modelSteps(state.task)}
          step={state.modelStep}
          Renderer={Renderer}
          onNext={s.modelNext}
          onDone={s.modelDone}
        />
      )}

      {state.phase === "GUIDED" && state.task && (
        <GuidedCard
          task={state.task}
          theme={theme}
          work={state.work}
          Renderer={Renderer}
          hint={state.hint}
          cue={
            (skill.remediation as Record<string, { explanationCue: string }>)[
              state.guidedCode ?? "UNCLASSIFIED"
            ]?.explanationCue ?? "Start on the left rod."
          }
          answerable={answerable}
          onChange={s.setWork}
          onPrompt={s.openPrompt}
          onSubmit={s.submitGuided}
          onShowModel={s.showModel}
        />
      )}

      {state.phase === "INDEPENDENT" && state.task && (
        <IndependentCard
          task={state.task}
          theme={theme}
          work={state.work}
          Renderer={Renderer}
          answerable={answerable}
          onChange={s.setWork}
          onSubmit={s.submitIndependent}
          onAbandon={s.abandon}
        />
      )}

      {state.phase === "FEEDBACK" && (
        <FeedbackCard
          message={message}
          correct={code === "CORRECT"}
          theme={theme}
          onNext={s.feedbackDone}
          nextLabel={state.independentCode === null ? "Your turn" : "Next task"}
        />
      )}

      {state.phase === "BREAK" && <BreakCard theme={theme} onContinue={s.endBreak} />}

      {state.phase === "DONE" && (
        <>
          <DoneCard theme={theme} tasks={state.index} />
          <Link
            href="/caregiver"
            className="self-start rounded-2xl border-2 border-[var(--line)] bg-[var(--surface)] px-7 py-4 text-xl text-[var(--ink-soft)]"
          >
            Open the caregiver view
          </Link>
        </>
      )}
    </Shell>
  );
}

/**
 * Surface D, client side. Asks the route handler to shorten the correction
 * only when the child's profile says the original is too long, and renders
 * the original until (and unless) a valid rewrite comes back.
 */
function useAdaptedLanguage(text: string, maxWords: number): string {
  // Keyed by the sentence it belongs to, so a new correction shows its own
  // wording immediately instead of briefly showing the previous rewrite.
  const [rewrite, setRewrite] = useState<{ of: string; value: string } | null>(null);
  const adapted = rewrite?.of === text ? rewrite.value : text;

  useEffect(() => {
    if (!text || countWords(text) <= maxWords) return;

    const ac = new AbortController();
    fetch("/api/ai/simplify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, maxWords }),
      signal: ac.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { value?: string; source?: string } | null) => {
        if (body?.source === "model" && body.value) {
          setRewrite({ of: text, value: body.value });
        }
      })
      .catch(() => {
        // The original sentence is already on screen.
      });

    return () => ac.abort();
  }, [text, maxWords]);

  return adapted;
}
