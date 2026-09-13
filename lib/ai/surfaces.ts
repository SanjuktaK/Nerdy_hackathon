// ============================================================
// §9.2 / §9.3 / §9.4 — the three non-headline AI surfaces.
//
// Each one has a deterministic fallback, and each one is fenced:
//   B  writes prose, never a judgement
//   C  writes a hypothesis, never a next task
//   D  rewrites language, never a number
// ============================================================

import { resolveProvider } from "./provider";
import {
  HYPOTHESIS_SYSTEM,
  NARRATIVE_SYSTEM,
  SIMPLIFY_SYSTEM,
} from "./prompts";
import { validateCorrection, validateNarrative } from "./validate";
import type { SessionSummary } from "../policy/summary";
import { templateNarrative } from "../policy/summary";
import type { BeadState } from "../core/bead-frame";

export interface SurfaceResult<T> {
  value: T;
  source: "model" | "fallback";
  failures?: string[];
  latencyMs: number;
}

// ---------- Surface B — caregiver narrative (§9.2) ----------
//
// One call per session. `NON_CANONICAL ×4` is not something anyone
// should have to read.

export async function caregiverNarrative(
  summary: SessionSummary
): Promise<SurfaceResult<string>> {
  const started = Date.now();
  const fallback = templateNarrative(summary);

  try {
    const provider = await resolveProvider();
    if (provider.id === "none") {
      return { value: fallback, source: "fallback", latencyMs: Date.now() - started };
    }

    const raw = await provider.complete({
      system: NARRATIVE_SYSTEM,
      user: narrativeUserPrompt(summary),
      temperature: 0.4,
      maxTokens: 220,
    });

    const text = raw.trim().replace(/^["']|["']$/g, "");
    const check = validateNarrative(text, 110);
    if (!check.ok) {
      return {
        value: fallback,
        source: "fallback",
        failures: check.failures,
        latencyMs: Date.now() - started,
      };
    }
    return { value: text, source: "model", latencyMs: Date.now() - started };
  } catch (e) {
    return {
      value: fallback,
      source: "fallback",
      failures: [e instanceof Error ? e.message : String(e)],
      latencyMs: Date.now() - started,
    };
  }
}

/** Never hand the model a code it can echo back at a parent. */
const MATERIAL_NAME: Record<string, string> = {
  C: "beads the child could touch",
  R: "drawn sticks and dots",
  A: "written numbers",
};

export function narrativeUserPrompt(s: SessionSummary): string {
  const lines = [
    `Tasks answered independently: ${s.taskCount}`,
    `Built correctly on the first try: ${s.correctCount}`,
    `Prompt opened on: ${s.promptedCount}`,
    `Left without an answer: ${s.abandonedCount}`,
    `Typical time per task: ${Math.round(s.medianLatencyMs / 1000)} seconds`,
    `Interests used: ${s.interests.join(", ") || "none recorded"}`,
    `Skills: ${s.skills.map((k) => `${k.title} ${k.correct}/${k.tasks}`).join("; ") || "none"}`,
    `Materials: ${
      s.representations
        .map((r) => `${MATERIAL_NAME[r.rep] ?? r.rep}: ${r.correct} of ${r.tasks} correct`)
        .join("; ") || "none"
    }`,
  ];
  if (s.topCodes.length) {
    lines.push(
      `Patterns observed: ${s.topCodes.map((c) => `${c.label} (${c.count})`).join("; ")}`
    );
  }
  return `Session facts:
${lines.join("\n")}

Write the paragraph. Use the material names exactly as written above. Never use a single capital letter as a label.`;
}

// ---------- Surface C — UNCLASSIFIED hypothesis (§9.3) ----------
//
// Shown to the caregiver, labelled as a hypothesis.
// NEVER drives task selection — the policy falls back to nextDifficulty 1
// on its own, before this function is ever called.

export interface HypothesisInput {
  tens: number;
  ones: number;
  targetNumber: number;
  taskType: string;
  addend?: number;
  startState?: BeadState;
}

export async function unclassifiedHypothesis(
  input: HypothesisInput
): Promise<SurfaceResult<string | null>> {
  const started = Date.now();
  try {
    const provider = await resolveProvider();
    if (provider.id === "none") {
      return { value: null, source: "fallback", latencyMs: Date.now() - started };
    }

    const total = input.tens * 10 + input.ones;
    const start = input.startState
      ? `The frame started with ${input.startState.tens} tens and ${input.startState.ones} ones, and ${input.addend} more ones were added.`
      : "The frame started empty.";

    const raw = await provider.complete({
      system: HYPOTHESIS_SYSTEM,
      user: `The task asked for ${input.targetNumber}. ${start}
The child left ${input.tens} beads on the tens rod and ${input.ones} beads on the ones rod, worth ${total}.
The rule-based classifier did not recognise the pattern. Suggest what the child may have been doing.`,
      temperature: 0.6,
      maxTokens: 120,
    });

    const text = raw.trim().replace(/^["']|["']$/g, "");
    const check = validateNarrative(text, 45);
    if (!check.ok) {
      return {
        value: null,
        source: "fallback",
        failures: check.failures,
        latencyMs: Date.now() - started,
      };
    }
    return { value: text, source: "model", latencyMs: Date.now() - started };
  } catch (e) {
    return {
      value: null,
      source: "fallback",
      failures: [e instanceof Error ? e.message : String(e)],
      latencyMs: Date.now() - started,
    };
  }
}

// ---------- Surface D — adaptive language load (§9.4) ----------
//
// Same correction, rewritten at the reading level the child's profile
// tolerates. The original is always the fallback, so a failure here
// costs nothing.

export async function adaptLanguage(
  text: string,
  maxWords: number
): Promise<SurfaceResult<string>> {
  const started = Date.now();
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words <= maxWords) {
    return { value: text, source: "fallback", latencyMs: 0 };
  }

  try {
    const provider = await resolveProvider();
    if (provider.id === "none") {
      return { value: text, source: "fallback", latencyMs: Date.now() - started };
    }

    const raw = await provider.complete({
      system: SIMPLIFY_SYSTEM,
      user: `Rewrite in at most ${maxWords} words:\n${text}`,
      temperature: 0.3,
      maxTokens: 80,
    });

    const out = raw.trim().replace(/^["']|["']$/g, "").split("\n")[0].trim();

    // The number must survive verbatim. A rewrite that changes a numeral
    // has changed the task, which this surface is not allowed to do.
    const before = text.match(/\d+/g) ?? [];
    const after = out.match(/\d+/g) ?? [];
    const numbersKept =
      before.length === after.length && before.every((n, i) => n === after[i]);

    const check = validateCorrection(out, maxWords);
    if (!check.ok || !numbersKept) {
      return {
        value: text,
        source: "fallback",
        failures: [...check.failures, ...(numbersKept ? [] : ["numeral changed"])],
        latencyMs: Date.now() - started,
      };
    }
    return { value: out, source: "model", latencyMs: Date.now() - started };
  } catch (e) {
    return {
      value: text,
      source: "fallback",
      failures: [e instanceof Error ? e.message : String(e)],
      latencyMs: Date.now() - started,
    };
  }
}
