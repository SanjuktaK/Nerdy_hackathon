"use client";

import { useState } from "react";
import { Button, Panel } from "./Bits";
import type { LearnerEvent } from "@/lib/core/types";
import { latestSession, summarise, templateNarrative } from "@/lib/policy/summary";

/** Surface B (§9.2) — one call per session, on the caregiver's press. */
export function NarrativePanel({
  events,
  canGenerate,
}: {
  events: LearnerEvent[];
  canGenerate: boolean;
}) {
  const session = latestSession(events);
  const fallback = templateNarrative(summarise(session));

  const [text, setText] = useState(fallback);
  const [source, setSource] = useState<"model" | "fallback">("fallback");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/ai/narrative", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events: session }),
      });
      const body = (await res.json()) as { value?: string; source?: "model" | "fallback" };
      if (body.value) {
        setText(body.value);
        setSource(body.source ?? "fallback");
      }
    } catch {
      setText(fallback);
      setSource("fallback");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="The last session, in a paragraph"
      note="Written from counts in the log. The log stays on this device until you press the button; then the counts — never the child's name — are sent to whichever model is running."
      action={
        canGenerate ? (
          <Button tone="primary" onClick={run} disabled={busy || session.length === 0}>
            {busy ? "Writing" : "Write it"}
          </Button>
        ) : undefined
      }
    >
      <p className="max-w-prose text-lg leading-relaxed">{text}</p>
      <p className="mt-3 text-sm text-[var(--ink-soft)]">
        {source === "model"
          ? "Written by the language model, checked for clinical wording before it was shown."
          : "Written by the app itself, with no model involved."}
      </p>
    </Panel>
  );
}

/**
 * Surface C (§9.3) — a hypothesis about an answer the rules did not
 * recognise. It is labelled as a guess, and it has already had no effect
 * on the child's next task: the policy resolved that the moment the
 * classifier returned UNCLASSIFIED.
 */
export function HypothesisPanel({
  events,
  canGenerate,
}: {
  events: LearnerEvent[];
  canGenerate: boolean;
}) {
  const unknowns = events.filter((e) => e.result === "UNCLASSIFIED" && !e.abandoned).slice(-3);
  const [text, setText] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  if (unknowns.length === 0) return null;

  async function ask(ev: LearnerEvent) {
    setBusy(ev.taskId + ev.ts);
    try {
      const res = await fetch("/api/ai/hypothesis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tens: 0,
          ones: 0,
          targetNumber: ev.targetNumber,
          taskType: ev.taskType,
        }),
      });
      const body = (await res.json()) as { value?: string | null };
      setText((t) => ({
        ...t,
        [ev.taskId + ev.ts]: body.value ?? "The model did not produce a usable suggestion.",
      }));
    } catch {
      setText((t) => ({ ...t, [ev.taskId + ev.ts]: "The model could not be reached." }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel
      title="Answers the app did not recognise"
      note="The rules cover the patterns we know. When an answer falls outside them the app says so rather than guessing — and the child is simply given easier ground next. You can ask the model for a hypothesis here; it changes nothing about what the child sees."
    >
      <ul className="flex flex-col gap-3">
        {unknowns.map((ev) => {
          const key = ev.taskId + ev.ts;
          return (
            <li key={key} className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  Target {ev.targetNumber} ·{" "}
                  {new Date(ev.ts).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                </span>
                {canGenerate && !text[key] && (
                  <Button onClick={() => ask(ev)} disabled={busy === key}>
                    {busy === key ? "Asking" : "Ask for a hypothesis"}
                  </Button>
                )}
              </div>
              {text[key] && (
                <p className="mt-3">
                  <span className="mr-2 rounded bg-[var(--accent-soft)] px-2 py-0.5 text-xs uppercase tracking-wide">
                    hypothesis
                  </span>
                  {text[key]}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
