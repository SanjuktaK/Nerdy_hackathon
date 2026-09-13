"use client";

import Link from "next/link";
import type { Phase } from "@/lib/core/types";
import { paletteCssVars, type Theme } from "@/lib/theme";
import { phaseLabel } from "@/lib/session/machine";
import { ProgressPath } from "./ProgressPath";

/**
 * The one piece of chrome the child sees. It shows, always and literally:
 * where they are in the session, what phase they are in, and how to stop.
 *
 * What it deliberately has no room for: a timer, a streak counter, a score,
 * a badge, or a sound that fires on success. Each of those is a documented
 * barrier for this population, and leaving space for them invites them back.
 */
export function Shell({
  theme,
  phase,
  index,
  total,
  children,
}: {
  theme: Theme;
  phase: Phase;
  index: number;
  total: number;
  children: React.ReactNode;
}) {
  const done = Math.min(index, total);

  return (
    <div
      style={paletteCssVars(theme.palette)}
      className="min-h-full bg-[var(--bg)] text-[var(--ink)]"
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-5 px-5 py-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <span className="rounded-full bg-[var(--surface)] px-4 py-1.5 text-base text-[var(--ink-soft)]">
            {phaseLabel[phase]}
          </span>
          <Link
            href="/caregiver"
            className="rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-base text-[var(--ink-soft)]"
          >
            Stop
          </Link>
        </header>

        {/* Centred, not top-pinned. A single card stranded at the top of a
            large screen reads as an error state; the child's work should sit
            where their eyes already are. */}
        <main className="flex flex-1 flex-col justify-center gap-6 py-2">{children}</main>

        <ProgressPath
          character={theme.character}
          done={done}
          total={total}
          motionLevel={theme.motionLevel}
          atRest={phase === "BREAK" || phase === "DONE"}
        />

      </div>
    </div>
  );
}

export function BigButton({
  children,
  onClick,
  tone = "primary",
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "primary" | "quiet";
  disabled?: boolean;
}) {
  const base =
    "rounded-2xl border-2 px-7 py-4 text-xl transition-colors disabled:opacity-40";
  const styles =
    tone === "primary"
      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]"
      : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)]";
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border-2 border-[var(--line)] bg-[var(--surface)] p-7">
      {children}
    </section>
  );
}
