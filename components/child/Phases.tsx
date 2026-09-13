"use client";

import { useState } from "react";
import { BigButton, Card } from "./Shell";
import { CharacterMark } from "./Sprite";
import { StemLine } from "./StemLine";
import type { Task } from "@/lib/core/types";
import type { ModelStep, RendererProps } from "@/lib/skills/types";
import type { Theme } from "@/lib/theme";
import type { ComponentType } from "react";

/**
 * The number, large, beside the sentence about it. A stem is the reason the
 * number is interesting; the number is the thing being built. Showing only
 * the sentence buried the maths in a paragraph.
 */
function TaskHeader({
  task,
  theme,
  autoRead,
  children,
}: {
  task: Task;
  theme: Theme;
  autoRead?: boolean;
  children?: React.ReactNode;
}) {
  const isExchange = task.type === "EXCHANGE";
  return (
    <Card>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div
          className="flex shrink-0 flex-col items-center justify-center rounded-3xl px-7 py-5"
          style={{ background: "var(--accent-soft)" }}
        >
          <span className="text-sm uppercase tracking-wide text-[var(--ink-soft)]">
            {isExchange ? "Make the total" : "Build"}
          </span>
          <strong className="text-6xl font-semibold tabular-nums leading-tight">
            {task.targetNumber}
          </strong>
        </div>
        <div className="flex-1">
          <StemLine
            stem={task.stem}
            spriteKey={task.spriteKey}
            theme={theme}
            autoRead={autoRead}
          />
        </div>
      </div>
      {children}
    </Card>
  );
}

// ---------- PREVIEW ----------
// Doubles as the generation wait screen (§9.5). The wait *is* the
// predictability feature: the child is told what is coming and how much
// of it, and nothing moves until they say go.

export function PreviewCard({
  text,
  theme,
  loading,
  onStart,
}: {
  text: string;
  theme: Theme;
  loading: boolean;
  onStart: () => void;
}) {
  return (
    <Card>
      <div className="flex flex-col items-center gap-6 py-6 text-center">
        <CharacterMark id={theme.character} size={104} mood="watching" />
        <div>
          <p className="text-4xl leading-snug">{text}</p>
          <p className="mt-3 text-xl text-[var(--ink-soft)]">
            {loading ? "The task is being set up." : "The task is ready."}
          </p>
        </div>
        <BigButton onClick={onStart} disabled={loading}>
          Start
        </BigButton>
      </div>
    </Card>
  );
}

// ---------- MODEL ----------

export function ModelCard<TState>({
  task,
  theme,
  steps,
  step,
  Renderer,
  onNext,
  onDone,
}: {
  task: Task;
  theme: Theme;
  steps: ModelStep<TState>[];
  step: number;
  Renderer: ComponentType<RendererProps<TState>>;
  onNext: () => void;
  onDone: () => void;
}) {
  const i = Math.min(step, steps.length - 1);
  const current = steps[i];
  const last = i >= steps.length - 1;

  return (
    <>
      <TaskHeader task={task} theme={theme}>
        <p
          className="mt-5 rounded-2xl px-5 py-4 text-xl"
          style={{ background: "var(--bg)" }}
        >
          Step {i + 1} of {steps.length}. {current.caption}
        </p>
      </TaskHeader>

      <Renderer
        state={current.state}
        task={task}
        onChange={() => {}}
        interactive={false}
        motionLevel={theme.motionLevel}
        hint={current.slot ? { slot: current.slot, message: current.caption } : null}
      />

      <div className="flex flex-wrap gap-3">
        {last ? (
          <BigButton onClick={onDone}>Try it together</BigButton>
        ) : (
          <BigButton onClick={onNext}>Next step</BigButton>
        )}
        {!last && (
          <BigButton tone="quiet" onClick={onDone}>
            Skip to trying
          </BigButton>
        )}
      </div>
    </>
  );
}

// ---------- GUIDED ----------
// The prompt is faded: available, never forced, and the fact that it was
// opened is logged rather than penalised.

export function GuidedCard<TState>({
  task,
  theme,
  work,
  Renderer,
  hint,
  cue,
  answerable,
  onChange,
  onPrompt,
  onSubmit,
  onShowModel,
}: {
  task: Task;
  theme: Theme;
  work: TState;
  Renderer: ComponentType<RendererProps<TState>>;
  hint: RendererProps<TState>["hint"];
  cue: string;
  answerable: boolean;
  onChange: (s: TState) => void;
  onPrompt: () => void;
  onSubmit: () => void;
  onShowModel: () => void;
}) {
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <>
      <TaskHeader task={task} theme={theme} autoRead>
        {hint && (
          <p
            className="mt-5 rounded-2xl px-5 py-4 text-xl"
            style={{ background: "var(--accent-soft)" }}
          >
            {hint.message}
          </p>
        )}
        {showPrompt && !hint && (
          <p className="mt-5 rounded-2xl bg-[var(--bg)] px-5 py-4 text-xl text-[var(--ink-soft)]">
            {cue}
          </p>
        )}
      </TaskHeader>

      <Renderer
        state={work}
        task={task}
        onChange={onChange}
        interactive
        motionLevel={theme.motionLevel}
        hint={hint}
      />

      <div className="flex flex-wrap gap-3">
        <BigButton onClick={onSubmit} disabled={!answerable}>
          Done
        </BigButton>
        {!showPrompt && (
          <BigButton
            tone="quiet"
            onClick={() => {
              setShowPrompt(true);
              onPrompt();
            }}
          >
            Show a prompt
          </BigButton>
        )}
        <BigButton tone="quiet" onClick={onShowModel}>
          Show me how
        </BigButton>
      </div>
    </>
  );
}

// ---------- INDEPENDENT ----------

export function IndependentCard<TState>({
  task,
  theme,
  work,
  Renderer,
  answerable,
  onChange,
  onSubmit,
  onAbandon,
}: {
  task: Task;
  theme: Theme;
  work: TState;
  Renderer: ComponentType<RendererProps<TState>>;
  answerable: boolean;
  onChange: (s: TState) => void;
  onSubmit: () => void;
  onAbandon: () => void;
}) {
  return (
    <>
      <TaskHeader task={task} theme={theme} autoRead>
        <p className="mt-5 text-xl text-[var(--ink-soft)]">Build the number on your own.</p>
      </TaskHeader>

      <Renderer
        state={work}
        task={task}
        onChange={onChange}
        interactive
        motionLevel={theme.motionLevel}
        hint={null}
      />

      <div className="flex flex-wrap gap-3">
        <BigButton onClick={onSubmit} disabled={!answerable}>
          Done
        </BigButton>
        <BigButton tone="quiet" onClick={onAbandon}>
          Skip this one
        </BigButton>
      </div>
    </>
  );
}

// ---------- FEEDBACK ----------
// One literal sentence. No red X, no buzzer, no confetti on the way in
// either — a success sound is as much of a sensory event as a failure one.

export function FeedbackCard({
  message,
  correct,
  theme,
  onNext,
  nextLabel,
}: {
  message: string;
  correct: boolean;
  theme: Theme;
  onNext: () => void;
  nextLabel: string;
}) {
  return (
    <Card>
      <div className="flex items-start gap-5">
        <CharacterMark
          id={theme.character}
          size={56}
          mood={correct ? "pleased" : "thinking"}
        />
        <div>
          <p className="text-2xl leading-snug">{message}</p>
          <p className="mt-2 text-lg text-[var(--ink-soft)]">
            {correct ? "The frame matches the number." : "The next step is written above."}
          </p>
        </div>
      </div>
      <div className="mt-7">
        <BigButton onClick={onNext}>{nextLabel}</BigButton>
      </div>
    </Card>
  );
}

// ---------- BREAK / DONE ----------

export function BreakCard({ theme, onContinue }: { theme: Theme; onContinue: () => void }) {
  return (
    <Card>
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <CharacterMark id={theme.character} size={104} mood="calm" />
        <div>
          <p className="text-4xl">Break.</p>
          <p className="mt-3 text-xl text-[var(--ink-soft)]">
            The break lasts as long as you want. Press Continue when you are ready.
          </p>
        </div>
        <BigButton onClick={onContinue}>Continue</BigButton>
      </div>
    </Card>
  );
}

export function DoneCard({ theme, tasks }: { theme: Theme; tasks: number }) {
  return (
    <Card>
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <CharacterMark id={theme.character} size={104} mood="pleased" />
        <div>
          <p className="text-4xl">Finished.</p>
          <p className="mt-3 text-xl text-[var(--ink-soft)]">
            {tasks} number {tasks === 1 ? "task" : "tasks"} are done. The session ends here.
          </p>
        </div>
      </div>
    </Card>
  );
}
