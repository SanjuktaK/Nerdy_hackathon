// ============================================================
// L2 — the session orchestrator.
//
//   PREVIEW      "Next: three number tasks. Then a break."
//      ↓         Doubles as the generation wait screen (§9.5)
//   MODEL        System animates the solution step by step   — I do
//      ↓
//   GUIDED       Child acts, faded prompt available          — we do
//      ↓         Errors → errorless retry, not a red X
//   INDEPENDENT  Child acts unaided; this is what scores     — you do
//      ↓
//   FEEDBACK     Deterministic classification, literal wording
//      ↓
//   LOG + SELECT Event written, policy picks next task
//
// The reducer is pure. Everything asynchronous (content lookup, model
// calls) happens outside it and arrives as a TASK_READY action.
// ============================================================

import type { Phase, Task } from "../core/types";
import type { HintSpec } from "../skills/types";
import type { Cursor } from "../policy/select";

export interface SessionPlan {
  tasksPerBlock: number;
  blocks: number;
}

export const planTotal = (p: SessionPlan) => p.tasksPerBlock * p.blocks;

export interface SessionState {
  phase: Phase;
  plan: SessionPlan;
  /** 0-based index of the current task within the whole session. */
  index: number;
  cursor: Cursor;
  task: Task | null;
  /** The manipulative's state. Opaque to L2 — only the skill module reads it. */
  work: unknown;
  modelStep: number;
  /** Set once the child opens the faded prompt; logged on the event. */
  promptUsed: boolean;
  /** Errorless retries used in GUIDED on this task. */
  retries: number;
  hint: HintSpec | null;
  guidedCode: string | null;
  independentCode: string | null;
  phaseEnteredAt: number;
  /** When the child's own attempt started, for latency. */
  attemptStartedAt: number;
  recentTargets: number[];
  /** Rotation counter — keeps selection deterministic without randomness. */
  rotation: number;
  /** True while the next task is being fetched; PREVIEW covers the wait. */
  loading: boolean;
  /**
   * Whether this task opens with the walkthrough.
   *
   * The architecture draws MODEL on every task. In practice a child who has
   * already worked this rung at this representation is being made to sit
   * through a demonstration of something they just did, which is its own
   * kind of disrespect — and the phase is skippable anyway, so in practice
   * it becomes a button to dismiss. The walkthrough is therefore shown on
   * genuinely new ground, after a step back, and whenever the errorless
   * retry budget runs out. It is always reachable from GUIDED.
   */
  showModel: boolean;
}

export type SessionAction =
  | { type: "TASK_LOADING" }
  | { type: "SET_CURSOR"; cursor: Cursor }
  | { type: "TASK_READY"; task: Task; work: unknown; cursor: Cursor; showModel: boolean }
  | { type: "PREVIEW_DONE"; now?: number }
  | { type: "MODEL_NEXT"; now?: number }
  | { type: "SHOW_MODEL"; now?: number }
  | { type: "MODEL_DONE"; now?: number }
  | { type: "WORK_CHANGED"; work: unknown }
  | { type: "PROMPT_OPENED" }
  | { type: "GUIDED_SUBMIT"; code: string; hint: HintSpec | null; now?: number }
  | { type: "GUIDED_RETRY"; work: unknown; now?: number }
  | { type: "GUIDED_ACCEPT"; work: unknown; now?: number }
  | { type: "INDEPENDENT_SUBMIT"; code: string; now?: number }
  | { type: "ABANDON"; now?: number }
  | { type: "FEEDBACK_DONE"; now?: number }
  | { type: "BREAK_DONE"; now?: number }
  | { type: "END" };

export const MAX_RETRIES = 2;

export function initialSession(plan: SessionPlan, cursor: Cursor, now = Date.now()): SessionState {
  return {
    phase: "PREVIEW",
    plan,
    index: 0,
    cursor,
    task: null,
    work: null,
    modelStep: 0,
    promptUsed: false,
    retries: 0,
    hint: null,
    guidedCode: null,
    independentCode: null,
    phaseEnteredAt: now,
    attemptStartedAt: now,
    recentTargets: [],
    rotation: 0,
    loading: true,
    showModel: true,
  };
}

const enter = (s: SessionState, phase: Phase, now: number): SessionState => ({
  ...s,
  phase,
  phaseEnteredAt: now,
});

export function sessionReducer(s: SessionState, a: SessionAction): SessionState {
  const now = "now" in a && a.now !== undefined ? a.now : Date.now();

  switch (a.type) {
    case "TASK_LOADING":
      return { ...s, loading: true };

    case "SET_CURSOR":
      // Moves the policy cursor without touching the phase. The loader
      // effect picks the change up and fetches the task for it.
      return { ...s, cursor: a.cursor, loading: true, task: null, work: null };

    case "TASK_READY":
      return {
        ...s,
        loading: false,
        task: a.task,
        work: a.work,
        cursor: a.cursor,
        showModel: a.showModel,
        modelStep: 0,
        promptUsed: false,
        retries: 0,
        hint: null,
        guidedCode: null,
        independentCode: null,
      };

    case "PREVIEW_DONE":
      // The child controls the transition out of PREVIEW. Nothing here is
      // on a timer — a timer is one of the documented barriers.
      if (!s.task) return s;
      return s.showModel
        ? enter({ ...s, modelStep: 0 }, "MODEL", now)
        : enter({ ...s, attemptStartedAt: now }, "GUIDED", now);

    case "SHOW_MODEL":
      // The child asking to see it again, from GUIDED.
      return enter({ ...s, modelStep: 0 }, "MODEL", now);

    case "MODEL_NEXT":
      return { ...s, modelStep: s.modelStep + 1 };

    case "MODEL_DONE":
      return enter({ ...s, attemptStartedAt: now }, "GUIDED", now);

    case "WORK_CHANGED":
      return { ...s, work: a.work };

    case "PROMPT_OPENED":
      return { ...s, promptUsed: true };

    case "GUIDED_SUBMIT":
      if (a.code === "CORRECT") {
        return enter({ ...s, guidedCode: a.code, hint: null }, "FEEDBACK", now);
      }
      // Errorless retry: the hint appears, the answer stays on screen, and
      // nothing is marked wrong. After MAX_RETRIES the walkthrough is shown
      // again rather than leaving the child stuck.
      return s.retries >= MAX_RETRIES
        ? enter({ ...s, guidedCode: a.code, hint: null, modelStep: 0 }, "MODEL", now)
        : { ...s, guidedCode: a.code, hint: a.hint, retries: s.retries + 1 };

    case "GUIDED_RETRY":
      return { ...s, work: a.work, hint: s.hint };

    case "GUIDED_ACCEPT":
      // The frame is reset and the same number is asked once more, unaided.
      return enter(
        { ...s, work: a.work, hint: null, attemptStartedAt: now },
        "INDEPENDENT",
        now
      );

    case "INDEPENDENT_SUBMIT":
      return enter({ ...s, independentCode: a.code }, "FEEDBACK", now);

    case "ABANDON":
      return enter({ ...s, independentCode: "UNCLASSIFIED" }, "FEEDBACK", now);

    case "FEEDBACK_DONE": {
      const nextIndex = s.index + 1;
      const target = s.task?.targetNumber;
      const recentTargets = (target === undefined
        ? s.recentTargets
        : [...s.recentTargets, target]
      ).slice(-3);

      if (nextIndex >= planTotal(s.plan)) {
        return enter({ ...s, index: nextIndex, recentTargets }, "DONE", now);
      }
      const atBreak = nextIndex % s.plan.tasksPerBlock === 0;
      return enter(
        {
          ...s,
          index: nextIndex,
          recentTargets,
          rotation: s.rotation + 1,
          loading: true,
          task: null,
          work: null,
        },
        atBreak ? "BREAK" : "PREVIEW",
        now
      );
    }

    case "BREAK_DONE":
      return enter(s, "PREVIEW", now);

    case "END":
      return enter(s, "DONE", now);

    default:
      return s;
  }
}

// ---------- PREVIEW copy ----------
//
// Literal, countable, and honest about what comes next. No "get ready",
// no countdown, no surprise.

export function previewText(s: SessionState): string {
  const doneInBlock = s.index % s.plan.tasksPerBlock;
  const left = s.plan.tasksPerBlock - doneInBlock;
  const blockIndex = Math.floor(s.index / s.plan.tasksPerBlock);
  const lastBlock = blockIndex === s.plan.blocks - 1;

  const count = `${left} number ${left === 1 ? "task" : "tasks"}`;
  return lastBlock ? `Next: ${count}. Then the session ends.` : `Next: ${count}. Then a break.`;
}

export const phaseLabel: Record<Phase, string> = {
  PREVIEW: "What comes next",
  MODEL: "Watch",
  GUIDED: "Try together",
  INDEPENDENT: "Your turn",
  FEEDBACK: "What happened",
  BREAK: "Break",
  DONE: "Finished",
};
