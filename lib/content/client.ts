"use client";

// ============================================================
// §7 request path, browser side.
//
// The static bank is bundled, so a seed-interest hit never leaves the
// tab. Only a genuine miss crosses to the route handler, and a dead
// network is treated exactly like a dead provider: nearest cached theme,
// silently.
// ============================================================

import type { StemSource, Task, TaskSpec, Representation } from "../core/types";
import {
  RUNTIME_CACHE_STORAGE_KEY,
  hydrateRuntimeCache,
  lookup,
  nearestTheme,
  onRuntimeCacheWrite,
  serialiseRuntimeCache,
  writeStems,
} from "./cache";
import type { StemEntry } from "./schema";
import { normaliseInterest } from "../theme";

let hydrated = false;

/** Call once, on mount. Safe to call repeatedly. */
export function initStemCache(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    hydrateRuntimeCache(window.localStorage.getItem(RUNTIME_CACHE_STORAGE_KEY));
  } catch {
    // A cache that cannot be read is a cache that is empty.
  }
  onRuntimeCacheWrite(() => {
    try {
      window.localStorage.setItem(RUNTIME_CACHE_STORAGE_KEY, serialiseRuntimeCache());
    } catch {
      // Quota. The in-memory tier still works for this session.
    }
  });
}

export interface StemResult {
  stem: string;
  spriteKey: string;
  source: StemSource;
  latencyMs: number;
}

/**
 * How long a child may be kept waiting on a model. Past this the nearest
 * cached theme is served instead — the generation is NOT cancelled, it
 * finishes in the background and lands in the runtime cache, so the next
 * task with that interest is both instant and personalised.
 *
 * The architecture budgets 2-5 s on a 3B model and covers it with the
 * PREVIEW screen. That holds when the wait is predictable; it does not hold
 * when a bigger model takes 15 s, and a child staring at a disabled button
 * is exactly the unpredictability this design exists to remove.
 */
export const GENERATION_DEADLINE_MS = 1500;

export async function fetchStem(
  spec: TaskSpec,
  interest: string,
  rotation = 0,
  signal?: AbortSignal
): Promise<StemResult> {
  const started = Date.now();
  const q = {
    skillId: spec.skillId,
    taskType: spec.type,
    difficulty: spec.difficulty,
    targetNumber: spec.targetNumber,
    interest: normaliseInterest(interest),
    rotation,
  };

  const hit = lookup(q);
  if (hit) {
    return {
      stem: hit.entry.stem,
      spriteKey: hit.entry.spriteKey,
      source: "cache",
      latencyMs: Date.now() - started,
    };
  }

  // Start the generation, and let it finish on its own schedule.
  const generation = generateAndCache(spec, q, signal);

  const winner = await Promise.race([
    generation,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), GENERATION_DEADLINE_MS)),
  ]);

  if (winner) return { ...winner, latencyMs: Date.now() - started };

  const near = nearestTheme(q);
  return {
    stem: near?.entry.stem ?? `Show ${spec.targetNumber}.`,
    spriteKey: near?.entry.spriteKey ?? "group-a",
    source: "fallback",
    latencyMs: Date.now() - started,
  };
}

async function generateAndCache(
  spec: TaskSpec,
  q: { skillId: string; taskType: string; difficulty: number; targetNumber: number; interest: string; rotation: number },
  signal?: AbortSignal
): Promise<{ stem: string; spriteKey: string; source: StemSource } | null> {
  try {
    const res = await fetch("/api/ai/stems", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...q, addend: spec.addend }),
      signal,
    });
    if (!res.ok) return null;

    const body = (await res.json()) as {
      stem: string;
      spriteKey: string;
      source: StemSource;
    };

    if (body.source === "generated") {
      const entry: StemEntry = {
        skillId: spec.skillId,
        taskType: spec.type,
        difficulty: spec.difficulty,
        targetNumber: spec.targetNumber,
        addend: spec.addend,
        interest: q.interest,
        stem: body.stem,
        spriteKey: body.spriteKey,
        source: "generated",
      };
      writeStems([entry]);
    }
    return body;
  } catch {
    // Offline, aborted, or the handler failed.
    return null;
  }
}

/**
 * Fill the cache for an interest ahead of a session. Called when a
 * caregiver applies a new interest, so the walk from the caregiver screen
 * to the child screen is itself the warm-up window.
 */
export function warmInterest(specs: readonly TaskSpec[], interest: string): void {
  void (async () => {
    for (const spec of specs) {
      const q = {
        skillId: spec.skillId,
        taskType: spec.type,
        difficulty: spec.difficulty,
        targetNumber: spec.targetNumber,
        interest: normaliseInterest(interest),
        rotation: 0,
      };
      if (lookup(q)) continue;
      await generateAndCache(spec, q);
    }
  })();
}

export function toTask(
  spec: TaskSpec,
  result: StemResult,
  interest: string,
  representation: Representation,
  index: number
): Task {
  return {
    ...spec,
    id: `${spec.skillId}-${spec.targetNumber}-${representation}-${index}`,
    interest: normaliseInterest(interest),
    spriteKey: result.spriteKey,
    stem: result.stem,
    representation,
    stemSource: result.source,
  };
}
