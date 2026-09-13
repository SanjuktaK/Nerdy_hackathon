"use client";

// ============================================================
// The session goal, made visible.
//
// A child needs a reason to do six tasks that is not "six tasks remain".
// This is that reason: each finished task lays one stone, the character
// moves onto it, and the far side is reached when the session ends.
//
// What it deliberately is NOT: a score, a streak, a timer, or a reward.
// There is nothing to lose, nothing to beat, and no way to fall behind —
// a stone is laid for a task that was finished, not for a task that was
// finished *correctly*, because the app does not grade children.
// ============================================================

import { CharacterMark } from "./Sprite";
import type { CharacterId, SensoryLevel } from "@/lib/theme";
import { motionMs } from "@/lib/theme";

export function ProgressPath({
  character,
  done,
  total,
  motionLevel,
  atRest,
}: {
  character: CharacterId;
  /** Tasks finished so far. */
  done: number;
  total: number;
  motionLevel: SensoryLevel;
  /** True on BREAK and DONE — the character stands rather than walks. */
  atRest?: boolean;
}) {
  const ms = motionMs(motionLevel);
  const finished = done >= total;
  const stand = Math.min(done, total - 1);

  return (
    <div
      className="rounded-3xl border-2 border-[var(--line)] bg-[var(--surface)] px-5 py-4"
      role="img"
      aria-label={`${done} of ${total} tasks finished`}
    >
      <div className="flex items-end gap-2">
        {Array.from({ length: total }).map((_, i) => {
          const laid = i < done;
          const here = i === stand && !finished;
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div style={{ height: 58 }} className="flex items-end">
                {(here || (finished && i === total - 1)) && (
                  <CharacterMark
                    id={character}
                    size={54}
                    mood={atRest ? "calm" : finished ? "pleased" : "alongside"}
                  />
                )}
              </div>
              <div
                className="w-full rounded-xl"
                style={{
                  height: laid ? 18 : 14,
                  background: laid ? "var(--settled)" : "transparent",
                  border: `2px ${laid ? "solid" : "dashed"} ${laid ? "var(--settled)" : "var(--line)"}`,
                  opacity: laid ? 1 : 0.5,
                  transition: ms
                    ? `background-color ${ms}ms, border-color ${ms}ms, height ${ms}ms`
                    : "none",
                }}
              />
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-center text-base text-[var(--ink-soft)]">
        {finished
          ? "The path is finished."
          : done === 0
            ? `${total} stones to lay.`
            : `${total - done} ${total - done === 1 ? "stone" : "stones"} left to lay.`}
      </p>
    </div>
  );
}
