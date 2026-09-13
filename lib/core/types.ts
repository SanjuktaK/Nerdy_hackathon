// ============================================================
// L0 — Core vocabulary shared by every layer.
// Nothing here knows about a specific skill or manipulative.
// ============================================================

export type Band = "K" | "1" | "2" | "3" | "4" | "5";

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export const DIFFICULTIES: readonly Difficulty[] = [1, 2, 3, 4, 5];

/** Concrete → Representational → Abstract. Advancement is representation-first. */
export type Representation = "C" | "R" | "A";

export const REPRESENTATIONS: readonly Representation[] = ["C", "R", "A"];

export type ManipulativeId =
  | "beadFrame"
  | "tenFrame"
  | "baseTen"
  | "arrayGrid"
  | "fractionBar";

export type SkillStatus = "SHIPS" | "STUB" | "ROADMAP";

/** Session phases (§4). CLASSIFY and SELECT are instantaneous; BREAK is scheduled. */
export type Phase =
  | "PREVIEW"
  | "MODEL"
  | "GUIDED"
  | "INDEPENDENT"
  | "FEEDBACK"
  | "BREAK"
  | "DONE";

/** Only INDEPENDENT results feed mastery (§6.1). */
export type ScoringPhase = "GUIDED" | "INDEPENDENT";

// ---------- Tasks ----------

/**
 * The structural half of a task. Every field here is chosen by the
 * deterministic policy. The model never writes one of these.
 */
export interface TaskSpec {
  skillId: string;
  /** Skill-local task type, e.g. "REPRESENT" | "EXCHANGE". */
  type: string;
  /** REPRESENT: show this. EXCHANGE: the result after adding `addend`. */
  targetNumber: number;
  /** EXCHANGE only: the manipulative is pre-loaded with this state. */
  startState?: unknown;
  /** EXCHANGE only: chosen so the ones column overflows past ten. */
  addend?: number;
  difficulty: Difficulty;
  /** Tags the remediation policy filters on (§6.2). */
  focusTags: readonly string[];
}

/**
 * A TaskSpec with language and presentation attached. The stem and sprite
 * are the *only* fields the content layer (and therefore the model) supplies.
 */
export interface Task extends TaskSpec {
  id: string;
  interest: string;
  spriteKey: string;
  /** The sentence read aloud to the child. ≤ 14 words, literal. */
  stem: string;
  representation: Representation;
  /** Where the stem came from — surfaced in the caregiver app, never to the child. */
  stemSource: StemSource;
}

export type StemSource = "cache" | "generated" | "fallback" | "template";

// ---------- Remediation ----------

export interface Remediation {
  /** A rung on the ladder, or a relative move the policy resolves. */
  nextDifficulty: Difficulty | "HOLD" | "ADVANCE";
  /** What the next task should stress. Matched against TaskSpec.focusTags. */
  focus: string;
  /** Seeds the child-facing correction. Never shown raw. */
  explanationCue: string;
}

// ---------- Events (§11) ----------

export interface LearnerEvent {
  ts: number;
  skillId: string;
  taskId: string;
  taskType: string;
  targetNumber: number;
  phase: ScoringPhase;
  difficulty: Difficulty;
  representation: Representation;
  /** The misconception code the skill's classifier returned. */
  result: string;
  latencyMs: number;
  promptUsed: boolean;
  abandoned: boolean;
  interest: string;
  stemSource: StemSource;
}

export const isCorrect = (code: string): boolean => code === "CORRECT";
