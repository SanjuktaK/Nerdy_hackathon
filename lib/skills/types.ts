import type { ComponentType } from "react";
import type {
  Band,
  Difficulty,
  ManipulativeId,
  Remediation,
  Representation,
  SkillStatus,
  Task,
  TaskSpec,
} from "../core/types";

/**
 * The surface a CRA renderer is handed. All three renderings receive the
 * identical state object — that is the CRA claim, enforced by the type.
 */
export interface RendererProps<TState> {
  state: TState;
  task: Task;
  /** No-op when the phase is not interactive (PREVIEW / MODEL / FEEDBACK). */
  onChange: (next: TState) => void;
  interactive: boolean;
  /** 0 = none, 1 = calm, 2 = full. From the theme (§8). */
  motionLevel: 0 | 1 | 2;
  /** Set during errorless retry: the correct element is highlighted. */
  hint?: HintSpec | null;
}

/** A minimal, manipulative-agnostic way to point at part of the display. */
export interface HintSpec {
  /** Renderer-local slot name, e.g. "tens" | "ones". */
  slot: string;
  /** What the slot should end up holding. */
  value?: number;
  message: string;
}

/** One frame of the MODEL-phase walkthrough (§4). */
export interface ModelStep<TState> {
  state: TState;
  /** Literal, ≤14 words, present tense. */
  caption: string;
  /** Optional slot to spotlight while this step is on screen. */
  slot?: string;
}

/**
 * How a misconception code rolls up into the caregiver-facing component
 * profile (§6.3). A code may feed more than one component.
 */
export interface ComponentSpec<TCode extends string> {
  id: ComponentId;
  label: string;
  /** Codes whose rate lowers this component's score. */
  penalisedBy: readonly TCode[];
}

export type ComponentId =
  | "placeValue"
  | "exchange"
  | "counting"
  | "representation"
  | "languageLoad";

/**
 * §5 — every skill is a plug-in conforming to this one interface.
 * TState is the manipulative's state; TCode is the skill's misconception
 * taxonomy, which keeps `remediation` exhaustive at compile time.
 */
export interface SkillModule<TState = unknown, TCode extends string = string> {
  id: string;
  band: Band;
  manipulative: ManipulativeId;
  status: SkillStatus;
  /** Plain language, shown to caregivers. Never jargon. */
  title: string;
  /** Default IEP goal text a caregiver can edit (§12). */
  iepGoalTemplate: string;

  emptyState(): TState;
  evaluate(state: TState): number;

  /** The state a task starts from — pre-loaded for exchange tasks. */
  initialState(task: Task): TState;
  /** Has the child done enough for this to count as an answer? */
  isAnswerable(state: TState, task: Task): boolean;

  classify(state: TState, task: Task): TCode;
  codes: readonly TCode[];
  remediation: Record<TCode, Remediation>;
  /** Child-facing, literal wording per code. Used by the FEEDBACK phase. */
  childMessage: Record<TCode, string>;

  render: {
    concrete: ComponentType<RendererProps<TState>>;
    representational: ComponentType<RendererProps<TState>>;
    abstract: ComponentType<RendererProps<TState>>;
  };

  /**
   * The rungs this skill actually has. `taskSpace` clamps to the nearest
   * rung, so a policy that advances past a skill's ceiling degrades to
   * holding rather than to an empty task space.
   */
  ladder: readonly Difficulty[];
  taskSpace(difficulty: Difficulty): TaskSpec[];
  /**
   * Does `n` belong on rung `d` of this skill's ladder? The stem validator
   * calls it to prove a generated sentence did not drift off the rung the
   * policy chose — which is the structure-preservation claim in §10.
   */
  inBand(d: Difficulty, n: number): boolean;
  modelSteps(task: Task): ModelStep<TState>[];
  /** The state a hint nudges toward, for errorless retry. */
  hintFor(state: TState, task: Task, code: TCode): HintSpec | null;

  components: readonly ComponentSpec<TCode>[];
  /** Sprite keys the content layer may use. The validator enforces this set. */
  spriteKeys: readonly string[];
}

/**
 * Type-erased handle for the registry.
 *
 * `unknown` cannot stand in here: the `render` fields are function-typed
 * properties, so they are contravariant in their props and a widened state
 * type stops a concrete module assigning. The erasure is the point — above
 * L4 nothing reads the state, it only passes it back to the module that
 * made it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySkillModule = SkillModule<any, string>;

export const rendererFor = <TState,>(
  skill: SkillModule<TState, string>,
  representation: Representation
): ComponentType<RendererProps<TState>> =>
  representation === "C"
    ? skill.render.concrete
    : representation === "R"
      ? skill.render.representational
      : skill.render.abstract;
