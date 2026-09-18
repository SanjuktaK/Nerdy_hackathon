"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import { Button, Field, Panel, inputClass } from "@/components/caregiver/Bits";
import { ThemeControls } from "@/components/caregiver/ThemeControls";
import {
  ComponentProfilePanel,
  FlagsPanel,
  HistoryPanel,
} from "@/components/caregiver/Progress";
import { HypothesisPanel, NarrativePanel } from "@/components/caregiver/AiPanels";
import {
  deleteEverything,
  exportBundle,
  getEventsServerSnapshot,
  getEventsSnapshot,
  getProfileServerSnapshot,
  getProfileSnapshot,
  newProfile,
  saveProfile,
  subscribeEvents,
  subscribeProfile,
  type Profile,
} from "@/lib/persistence/store";
import { ROADMAP, SKILLS, shippingSkills } from "@/lib/skills/registry";
import { lookup } from "@/lib/content/cache";
import { countWords } from "@/lib/ai/validate";
import type { Theme } from "@/lib/theme";
import { paletteCssVars } from "@/lib/theme";

interface Status {
  provider: { id: string; label: string; available: boolean; canGenerate: boolean; model?: string };
  cache: { size: number; interests: number; generatedAt: string; producedBy: string };
}

export default function CaregiverApp() {
  // Both come from the same device-local store the child app writes to, so
  // finishing a session and opening this page shows the new events at once.
  const stored = useSyncExternalStore(
    subscribeProfile,
    getProfileSnapshot,
    getProfileServerSnapshot
  );
  const events = useSyncExternalStore(
    subscribeEvents,
    getEventsSnapshot,
    getEventsServerSnapshot
  );
  const profile = stored;

  const [status, setStatus] = useState<Status | null>(null);

  // A caregiver may land here before any session has run. Writing the
  // default to the store rather than to component state keeps this page and
  // the child app looking at the same profile.
  useEffect(() => {
    if (!getProfileSnapshot()) saveProfile(newProfile(""));
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/ai/status", { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: Status | null) => s && setStatus(s))
      .catch(() => {
        // The status panel says "checking" and the page works without it.
      });
    return () => ac.abort();
  }, []);

  // Stem word counts, recovered from the cache so the language-load bar
  // has real sentence lengths rather than an assumed one.
  const stemWords = useMemo(() => {
    const m = new Map<string, number>();
    for (const ev of events) {
      const hit = lookup({
        skillId: ev.skillId,
        taskType: ev.taskType,
        difficulty: ev.difficulty,
        targetNumber: ev.targetNumber,
        interest: ev.interest,
      });
      if (hit) m.set(ev.taskId, countWords(hit.entry.stem));
    }
    return m;
  }, [events]);

  if (!profile) {
    return <main className="mx-auto max-w-3xl px-6 py-16">Loading this device&rsquo;s profile.</main>;
  }

  const update = (next: Profile) => saveProfile(next);

  const canGenerate = status?.provider.canGenerate ?? false;

  return (
    <div style={paletteCssVars(profile.theme.palette)} className="min-h-full bg-[var(--bg)] text-[var(--ink)]">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Caregiver view</h1>
            <p className="text-sm text-[var(--ink-soft)]">
              Everything on this page is stored on this device only. No account, no server, no analytics.
            </p>
          </div>
          <Link
            href="/classic"
            className="rounded-xl border-2 border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2"
          >
            Open the child app
          </Link>
        </header>

        <ProfilePanel profile={profile} onChange={update} />

        <ThemeControls
          theme={profile.theme}
          canGenerate={canGenerate}
          onApply={(theme: Theme) => update({ ...profile, theme })}
        />

        <ComponentProfilePanel events={events} stemWords={stemWords} />
        <FlagsPanel events={events} />
        <NarrativePanel events={events} canGenerate={canGenerate} />
        <HypothesisPanel events={events} canGenerate={canGenerate} />
        <HistoryPanel events={events} />
        <GoalsPanel profile={profile} onChange={update} />
        <SystemPanel status={status} />
        <DataPanel onDeleted={() => saveProfile(newProfile(""))} />
      </div>
    </div>
  );
}

function ProfilePanel({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  return (
    <Panel
      title="Profile"
      note="A name is optional and never leaves this device. Session length is the number of tasks before a break, and how many of those blocks a session has."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Name or nickname">
          <input
            className={inputClass}
            value={profile.name}
            onChange={(e) => onChange({ ...profile, name: e.target.value })}
            placeholder="optional"
          />
        </Field>
        <Field label="Tasks before a break">
          <input
            type="number"
            min={1}
            max={8}
            className={inputClass}
            value={profile.tasksPerBlock}
            onChange={(e) =>
              onChange({ ...profile, tasksPerBlock: Math.max(1, Math.min(8, Number(e.target.value) || 3)) })
            }
          />
        </Field>
        <Field label="Blocks in a session">
          <input
            type="number"
            min={1}
            max={6}
            className={inputClass}
            value={profile.blocksPerSession}
            onChange={(e) =>
              onChange({ ...profile, blocksPerSession: Math.max(1, Math.min(6, Number(e.target.value) || 2)) })
            }
          />
        </Field>
      </div>
    </Panel>
  );
}

function GoalsPanel({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  return (
    <Panel
      title="Goals by skill"
      note="One editable goal per skill, in the wording an IEP uses. The app does not check these against anything — they are here so the progress above sits next to the goal it belongs to."
    >
      <div className="flex flex-col gap-5">
        {shippingSkills().map((s) => (
          <Field key={s.id} label={`${s.title} · Grade ${s.band}`}>
            <textarea
              className={`${inputClass} min-h-20`}
              value={profile.iepGoals[s.id] ?? s.iepGoalTemplate}
              onChange={(e) =>
                onChange({ ...profile, iepGoals: { ...profile.iepGoals, [s.id]: e.target.value } })
              }
            />
          </Field>
        ))}
      </div>

      <div className="mt-6 border-t border-[var(--line)] pt-5">
        <h3 className="mb-2 font-medium">Other bands</h3>
        <ul className="flex flex-col gap-1.5 text-sm text-[var(--ink-soft)]">
          {SKILLS.filter((s) => s.status === "STUB").map((s) => (
            <li key={s.id}>
              Grade {s.band} · {s.title} · {s.manipulative} — early version, not part of a session yet
            </li>
          ))}
          {ROADMAP.map((r) => (
            <li key={r.title}>
              Grade {r.band} · {r.title} · {r.manipulative} — planned
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

function SystemPanel({ status }: { status: Status | null }) {
  return (
    <Panel
      title="What is running"
      note="The lesson bank ships with the app. A language model is only ever reached when the bank has nothing for the interest you typed."
    >
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-[var(--ink-soft)]">Language model</dt>
          <dd>{status?.provider.label ?? "checking"}</dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--ink-soft)]">Free-text interests</dt>
          <dd>{status?.provider.canGenerate ? "available" : "unavailable — built-in interests only"}</dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--ink-soft)]">Built-in lessons</dt>
          <dd className="tabular-nums">
            {status?.cache.size ?? "—"} sentences across {status?.cache.interests ?? "—"} interests
          </dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--ink-soft)]">Bank built</dt>
          <dd>
            {status?.cache.generatedAt ?? "—"} · {status?.cache.producedBy ?? "—"}
          </dd>
        </div>
      </dl>
    </Panel>
  );
}

function DataPanel({ onDeleted }: { onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);

  function download() {
    const blob = new Blob([JSON.stringify(exportBundle(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `beadframe-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Panel
      title="Your data"
      note="There is no copy anywhere else. Export writes a file to this device; delete removes the profile, the history and the saved lessons from this browser and cannot be undone."
    >
      <div className="flex flex-wrap gap-3">
        <Button onClick={download}>Export everything as a file</Button>
        {confirming ? (
          <>
            <Button
              tone="danger"
              onClick={() => {
                deleteEverything();
                setConfirming(false);
                onDeleted();
              }}
            >
              Yes, delete it permanently
            </Button>
            <Button onClick={() => setConfirming(false)}>Keep it</Button>
          </>
        ) : (
          <Button tone="danger" onClick={() => setConfirming(true)}>
            Delete everything
          </Button>
        )}
      </div>
      <p className="mt-4 text-sm text-[var(--ink-soft)]">
        Not collected, by decision rather than by omission: camera, microphone, emotion or affect
        inference, analytics, advertising identifiers.
      </p>
    </Panel>
  );
}
