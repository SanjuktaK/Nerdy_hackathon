"use client";

// The way into the grown-ups page, with a small badge when there is
// something new to read. Tapping the badge opens a short list first, so a
// caregiver can glance without leaving the child's screen.

import Link from "next/link";
import { useState } from "react";

import type { Note } from "@/lib/learn/notes";
import { updateLearn } from "@/lib/learn/store";

export function GrownUpsLink({ notes, seen, align = "left" }: { notes: Note[]; seen: string[]; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const fresh = notes.filter((n) => !seen.includes(n.id));
  return (
    <div className="relative flex items-center gap-2">
      <Link href="/grown-ups" className="text-sm font-semibold text-[var(--ink-soft)] underline-offset-4 hover:underline">
        Grown-ups
      </Link>
      {fresh.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="note-badge"
          aria-expanded={open}
          aria-label={`${fresh.length} new note${fresh.length === 1 ? "" : "s"} for grown-ups`}
        >
          {fresh.length}
        </button>
      )}
      {open && fresh.length > 0 && (
        <div className={`note-pop ${align === "right" ? "note-pop-right" : ""}`} role="dialog" aria-label="Notes for grown-ups">
          <p className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--ink-soft)]">For grown-ups</p>
          <ul className="flex flex-col gap-3">
            {fresh.slice(0, 3).map((n) => (
              <li key={n.id}>
                <p className="font-display text-lg font-semibold leading-tight">{n.title}</p>
                <p className="text-sm text-[var(--ink-soft)]">{n.detail}</p>
                {n.quote && <p className="mt-1 rounded-lg bg-[#eef0ff] px-2 py-1 text-sm text-[#3e3f9a]">“{n.quote}”</p>}
                <button
                  type="button"
                  className="mt-1 text-sm font-semibold text-[var(--accent-strong)] underline underline-offset-2"
                  onClick={() => updateLearn({ seenNotes: [...new Set([...seen, n.id])] })}
                >
                  Got it
                </button>
              </li>
            ))}
          </ul>
          <Link href="/grown-ups#notes" className="btn-secondary mt-3 min-h-0! px-4! py-1.5! text-base!">
            Open the grown-ups page
          </Link>
        </div>
      )}
    </div>
  );
}
