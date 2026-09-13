"use client";

import {
  FRAME_COUNT,
  FRAME_SIZE,
  TEN_FRAME_CAPACITY,
  clampTenFrame,
  type TenFrameState,
} from "@/lib/core/ten-frame";
import type { RendererProps } from "@/lib/skills/types";
import { motionMs } from "@/lib/theme";

function cells(props: RendererProps<TenFrameState>, mode: "C" | "R") {
  const ms = motionMs(props.motionLevel);
  const set = (n: number) =>
    props.interactive && props.onChange(clampTenFrame({ filled: n }));

  return (
    <div className="flex flex-wrap gap-6">
      {Array.from({ length: FRAME_COUNT }).map((_, f) => (
        <div
          key={f}
          className="grid grid-cols-5 gap-1 rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] p-2"
          aria-label={`Frame ${f + 1}`}
        >
          {Array.from({ length: FRAME_SIZE }).map((_, i) => {
            const index = f * FRAME_SIZE + i;
            const on = index < props.state.filled;
            return (
              <button
                key={i}
                type="button"
                disabled={!props.interactive}
                aria-label={`Cell ${index + 1}`}
                aria-pressed={on}
                onClick={() => set(on ? index : index + 1)}
                className="flex h-12 w-12 items-center justify-center border border-[var(--line)]"
                style={{ cursor: props.interactive ? "pointer" : "default" }}
              >
                <span
                  className={mode === "C" ? "rounded-full" : "rounded-sm"}
                  style={{
                    width: 30,
                    height: 30,
                    background: on ? "var(--accent)" : "transparent",
                    border: mode === "R" ? `2px dashed var(--line)` : undefined,
                    transition: ms ? `background-color ${ms}ms` : "none",
                  }}
                />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function TenFrameConcrete(props: RendererProps<TenFrameState>) {
  return (
    <div>
      {cells(props, "C")}
      <p className="mt-3 text-lg text-[var(--ink-soft)]">
        {props.state.filled} counters placed.
      </p>
    </div>
  );
}

export function TenFrameRepresentational(props: RendererProps<TenFrameState>) {
  return (
    <div>
      {cells(props, "R")}
      <p className="mt-3 text-lg text-[var(--ink-soft)]">
        {props.state.filled} marks drawn.
      </p>
    </div>
  );
}

export function TenFrameAbstract(props: RendererProps<TenFrameState>) {
  return (
    <div className="rounded-2xl border-2 border-[var(--line)] bg-[var(--surface)] p-6 text-center">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={TEN_FRAME_CAPACITY}
        value={props.state.filled}
        disabled={!props.interactive}
        aria-label="Total"
        onChange={(e) =>
          props.onChange(clampTenFrame({ filled: Number(e.target.value || 0) }))
        }
        className="w-32 rounded-xl border-2 border-[var(--line)] bg-[var(--bg)] px-3 py-3 text-center text-4xl tabular-nums text-[var(--ink)]"
      />
      <p className="mt-3 text-lg text-[var(--ink-soft)]">The total is {props.state.filled}.</p>
    </div>
  );
}
