"use client";

import { useState } from "react";
import { Bar, Button, Panel } from "./Bits";
import type { LearnerEvent } from "@/lib/core/types";
import { componentProfile } from "@/lib/policy/profile";
import { attentionFlags } from "@/lib/policy/flags";
import { BEAD_CODE_LABEL, type BeadCode } from "@/lib/skills/bead-common";
import { getSkill, hasSkill } from "@/lib/skills/registry";
import { countWords } from "@/lib/ai/validate";

const stemWordsOf = (byTask: Map<string, number>) => (ev: LearnerEvent) =>
  byTask.get(ev.taskId) ?? 10;

export function ComponentProfilePanel({
  events,
  stemWords,
}: {
  events: LearnerEvent[];
  stemWords: Map<string, number>;
}) {
  const bars = componentProfile(events, stemWordsOf(stemWords));

  return (
    <Panel
      title="What the work shows"
      note="Each bar is counted from tasks answered without help. A bar with no data has not had enough tasks yet to mean anything."
    >
      <ul className="flex flex-col gap-5">
        {bars.map((b) => (
          <li key={b.id}>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">{b.label}</span>
              <span className="text-sm tabular-nums text-[var(--ink-soft)]">
                {b.score === null ? "not enough tasks yet" : `${Math.round(b.score * 100)}%`}
                {b.samples > 0 && ` · ${b.samples} tasks`}
              </span>
            </div>
            <Bar value={b.score} />
            <p className="mt-1.5 text-sm text-[var(--ink-soft)]">{b.plain}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function FlagsPanel({ events }: { events: LearnerEvent[] }) {
  const flags = attentionFlags(events);
  return (
    <Panel
      title="Worth a look"
      note="These are observations about the sessions, not conclusions about the child. This app does not diagnose anything."
    >
      {flags.length === 0 ? (
        <p className="text-[var(--ink-soft)]">
          Nothing has crossed a threshold. This is also what an empty log looks like.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {flags.map((f, i) => (
            <li key={i} className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4">
              <p>{f.text}</p>
              <p className="mt-1 font-mono text-xs text-[var(--ink-soft)]">{f.evidence}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const label = (code: string) => BEAD_CODE_LABEL[code as BeadCode] ?? code.toLowerCase().replace(/_/g, " ");

export function HistoryPanel({ events }: { events: LearnerEvent[] }) {
  const [open, setOpen] = useState(false);
  const scored = events.filter((e) => e.phase === "INDEPENDENT").slice(-40).reverse();
  const shown = open ? scored : scored.slice(0, 8);

  return (
    <Panel
      title="Task history"
      note="Every independent answer, newest first. The pattern column is what the app recognised — not a score."
      action={
        scored.length > 8 ? (
          <Button onClick={() => setOpen((o) => !o)}>{open ? "Show less" : `Show all ${scored.length}`}</Button>
        ) : undefined
      }
    >
      {scored.length === 0 ? (
        <p className="text-[var(--ink-soft)]">No independent answers recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
            <thead className="text-[var(--ink-soft)]">
              <tr>
                <th className="py-2 pr-4 font-medium">When</th>
                <th className="py-2 pr-4 font-medium">Skill</th>
                <th className="py-2 pr-4 font-medium">Number</th>
                <th className="py-2 pr-4 font-medium">Material</th>
                <th className="py-2 pr-4 font-medium">Pattern</th>
                <th className="py-2 pr-4 font-medium">Time</th>
                <th className="py-2 font-medium">Sentence from</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e, i) => (
                <tr key={i} className="border-t border-[var(--line)]">
                  <td className="py-2 pr-4 tabular-nums text-[var(--ink-soft)]">
                    {new Date(e.ts).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="py-2 pr-4">{hasSkill(e.skillId) ? getSkill(e.skillId).title : e.skillId}</td>
                  <td className="py-2 pr-4 tabular-nums">{e.targetNumber}</td>
                  <td className="py-2 pr-4">
                    {{ C: "beads", R: "drawings", A: "numbers" }[e.representation]}
                  </td>
                  <td className="py-2 pr-4">
                    {label(e.result)}
                    {e.promptUsed && <span className="text-[var(--ink-soft)]"> · prompt opened</span>}
                    {e.abandoned && <span className="text-[var(--ink-soft)]"> · skipped</span>}
                  </td>
                  <td className="py-2 pr-4 tabular-nums text-[var(--ink-soft)]">
                    {Math.round(e.latencyMs / 1000)}s
                  </td>
                  <td className="py-2 text-[var(--ink-soft)]">{e.stemSource}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export const wordCount = countWords;
